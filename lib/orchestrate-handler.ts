import { randomUUID } from "node:crypto";
import { z } from "zod";
import { generatePlan, PlannerError } from "./planner";
import { executeDag } from "./executor";
import { createRun } from "./ledger";

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
  executeDag(runId, plan).catch(() => {
    /* failures are recorded on the ledger by executeDag itself */
  });
  return { run_id: runId, stream: `/api/runs/${runId}/stream` };
}
