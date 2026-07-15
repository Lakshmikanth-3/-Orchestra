import { randomUUID } from "node:crypto";
import { z } from "zod";
import { generatePlan, PlannerError } from "./planner";
import { executeDag } from "./executor";
import { createRun, setRunStatus, appendEvent } from "./ledger";
import { publish } from "./bus";

export { PlannerError };

export const OrchestrateRequestSchema = z.object({
  intent: z.string().min(1),
  budget_usdt: z.number().positive(),
});

export interface StartRunResult {
  run_id: string;
  stream: string;
}

export async function startRun(intent: string, budgetUsdt: number, paidVia: string): Promise<StartRunResult> {
  const plan = await generatePlan(intent, budgetUsdt);
  const runId = randomUUID();
  await createRun(runId, intent, budgetUsdt, paidVia);

  // executeDag records per-task failures on the ledger itself and always emits
  // a terminal "settled" event on its own normal paths. This catch is a safety
  // net for anything that escapes that — e.g. a throw before its first
  // setRunStatus call, or from getRun/buildScoreReport/saveReport after the
  // task loop. Without it, such a crash was entirely silent and left every
  // subscribed SSE client hanging forever with no terminal event and no trace
  // in the ledger of what happened.
  executeDag(runId, plan).catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[orchestrate] run ${runId} crashed outside executeDag's own error handling:`, err);
    try {
      await setRunStatus(runId, "failed");
      const event = await appendEvent(runId, "settled", null, {
        totalSpentUsdt: 0,
        approvedUsdt: budgetUsdt,
        refundableUsdt: budgetUsdt,
        failedTasks: [],
        crashed: true,
        error: message,
      });
      publish(runId, event);
    } catch (ledgerErr) {
      console.error(`[orchestrate] run ${runId} also failed to record its own crash:`, ledgerErr);
    }
  });

  return { run_id: runId, stream: `/api/runs/${runId}/stream` };
}
