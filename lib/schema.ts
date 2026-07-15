import { z } from "zod";

export const CAPABILITIES = [
  "market_data",
  "news_scan",
  "risk_flags",
  "synthesize_report",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const TaskSchema = z.object({
  id: z.string().min(1),
  capability: z.enum(CAPABILITIES),
  prompt: z.string().min(1),
  depends_on: z.array(z.string()).default([]),
  max_spend_usdt: z.number().min(0),
});

export type PlanTask = z.infer<typeof TaskSchema>;

export const PlanSchema = z.object({
  tasks: z.array(TaskSchema).min(1).max(6),
});

export type Plan = z.infer<typeof PlanSchema>;

export function validatePlanBudget(plan: Plan, budgetUsdt: number): void {
  const total = plan.tasks.reduce((sum, t) => sum + t.max_spend_usdt, 0);
  const cap = budgetUsdt * 0.6;
  if (total > cap) {
    throw new Error(
      `Plan exceeds budget cap: sum(max_spend_usdt)=${total} > 60% of ${budgetUsdt} (=${cap})`
    );
  }

  const ids = new Set(plan.tasks.map((t) => t.id));
  if (ids.size !== plan.tasks.length) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const t of plan.tasks) {
      if (seen.has(t.id)) duplicates.add(t.id);
      seen.add(t.id);
    }
    throw new Error(
      `Plan has duplicate task id(s): ${[...duplicates].join(", ")} — every task id must be unique within a plan`
    );
  }

  for (const task of plan.tasks) {
    for (const dep of task.depends_on) {
      if (!ids.has(dep)) {
        throw new Error(`Task ${task.id} depends_on unknown task id "${dep}"`);
      }
      if (dep === task.id) {
        throw new Error(`Task ${task.id} cannot depend on itself`);
      }
    }
  }

  const dependsOn = new Map(plan.tasks.map((t) => [t.id, t.depends_on]));
  const state = new Map<string, "visiting" | "done">();

  function visit(id: string, path: string[]): void {
    const status = state.get(id);
    if (status === "done") return;
    if (status === "visiting") {
      throw new Error(`Plan has a dependency cycle: ${[...path, id].join(" -> ")}`);
    }
    state.set(id, "visiting");
    for (const dep of dependsOn.get(id) ?? []) {
      visit(dep, [...path, id]);
    }
    state.set(id, "done");
  }

  for (const task of plan.tasks) visit(task.id, []);
}
