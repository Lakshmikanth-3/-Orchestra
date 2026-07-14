import type { Plan, PlanTask } from "./schema";
import type { ExecutionOutcome } from "./executor";
import type { InternalSkillOutput } from "./skills";

export interface ReportSection {
  taskId: string;
  capability: string;
  provider: string;
  kind: "external_asp" | "internal";
  status: "delivered" | "failed";
  costUsdt: number;
  paymentRef: string;
  content: unknown;
  citedUrls: string[];
  error?: string;
}

export interface ScoreReport {
  runId: string;
  intent: string;
  budgetUsdt: number;
  totalSpentUsdt: number;
  status: "completed" | "failed";
  sections: ReportSection[];
}

function sectionContent(task: PlanTask, payload: unknown): { content: unknown; citedUrls: string[] } {
  if (task.capability === "market_data") return { content: payload, citedUrls: [] };
  const skill = payload as InternalSkillOutput;
  return { content: skill.text, citedUrls: skill.citedUrls ?? [] };
}

export function buildScoreReport(
  run: { id: string; intent: string; budgetUsdt: number },
  plan: Plan,
  outcome: ExecutionOutcome
): { json: ScoreReport; markdown: string } {
  const sections: ReportSection[] = plan.tasks.map((task) => {
    const failed = outcome.failedTasks.includes(task.id);
    const cost = outcome.costs[task.id];
    const { content, citedUrls } = failed ? { content: null, citedUrls: [] } : sectionContent(task, outcome.results[task.id]);

    return {
      taskId: task.id,
      capability: task.capability,
      provider: cost?.provider ?? (task.capability === "market_data" ? "CoinAnk" : "Orchestra internal skill"),
      kind: cost?.kind === "external_asp" ? "external_asp" : "internal",
      status: failed ? "failed" : "delivered",
      costUsdt: cost?.costUsdt ?? 0,
      paymentRef: cost?.paymentRef ?? "n/a",
      content,
      citedUrls,
    };
  });

  const json: ScoreReport = {
    runId: run.id,
    intent: run.intent,
    budgetUsdt: run.budgetUsdt,
    totalSpentUsdt: outcome.totalSpentUsdt,
    status: outcome.failedTasks.length > 0 ? "failed" : "completed",
    sections,
  };

  return { json, markdown: renderMarkdown(json) };
}

function renderMarkdown(report: ScoreReport): string {
  const lines: string[] = [];
  lines.push(`# Orchestra Score Report`);
  lines.push(``);
  lines.push(`**Run:** \`${report.runId}\``);
  lines.push(`**Intent:** ${report.intent}`);
  lines.push(`**Status:** ${report.status}`);
  lines.push(``);

  for (const section of report.sections) {
    const sourceLabel = section.kind === "external_asp" ? `External ASP — ${section.provider}` : `Internal skill — ${section.provider}`;
    lines.push(`## ${section.capability} (\`${section.taskId}\`)`);
    lines.push(`*Source: ${sourceLabel} · Status: ${section.status}*`);
    lines.push(``);
    if (section.status === "failed") {
      lines.push(`_This task failed and produced no data — nothing here is fabricated._`);
    } else if (typeof section.content === "string") {
      lines.push(section.content);
    } else {
      lines.push("```json");
      lines.push(JSON.stringify(section.content, null, 2));
      lines.push("```");
    }
    if (section.citedUrls.length) {
      lines.push(``);
      lines.push(`**Sources:** ${section.citedUrls.map((u) => `[${u}](${u})`).join(", ")}`);
    }
    lines.push(``);
  }

  lines.push(`## Itemized Costs`);
  lines.push(``);
  lines.push(`| Task | Capability | Provider | Cost (USDT) | Payment ref |`);
  lines.push(`|---|---|---|---|---|`);
  for (const s of report.sections) {
    lines.push(`| ${s.taskId} | ${s.capability} | ${s.provider} | ${s.costUsdt} | \`${s.paymentRef}\` |`);
  }
  lines.push(``);
  lines.push(`**Total spent:** ${report.totalSpentUsdt} USDT of ${report.budgetUsdt} USDT budget`);

  return lines.join("\n");
}
