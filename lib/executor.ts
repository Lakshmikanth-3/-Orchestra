import type { Plan, PlanTask } from "./schema";
import { dispatch } from "./dispatch";
import { appendEvent, setRunStatus, saveReport, getRun } from "./ledger";
import { publish } from "./bus";
import { buildScoreReport } from "./report";
import { providerFor } from "./registry";
import { isEscrowConfigured, lockTaskEscrow, settleTaskEscrow } from "./escrow";

const TASK_TIMEOUT_MS = 60_000;

async function emit(
  runId: string,
  type: Parameters<typeof appendEvent>[1],
  taskId: string | null,
  data: Record<string, unknown>
): Promise<void> {
  const event = await appendEvent(runId, type, taskId, data);
  publish(runId, event);
}

export interface TaskCost {
  provider: string;
  kind: string;
  costUsdt: number;
  paymentRef: string;
  escrowLockTx?: string;
  escrowSettleTx?: string;
  escrowError?: string;
}

export interface ExecutionOutcome {
  results: Record<string, unknown>;
  costs: Record<string, TaskCost>;
  failedTasks: string[];
  totalSpentUsdt: number;
  approvedUsdt: number;
  refundableUsdt: number;
}

export async function executeDag(runId: string, plan: Plan): Promise<ExecutionOutcome> {
  await setRunStatus(runId, "running");
  await emit(runId, "planned", null, { tasks: plan.tasks });

  const done = new Set<string>();
  const failed = new Set<string>();
  const results: Record<string, unknown> = {};
  const costs: ExecutionOutcome["costs"] = {};
  let totalSpentUsdt = 0;
  let pending = [...plan.tasks];

  while (pending.length) {
    const runnable = pending.filter((t) => t.depends_on.every((d) => done.has(d) || failed.has(d)));
    if (!runnable.length) {
      // A cycle among the remaining tasks (validatePlanBudget only rejects direct
      // self-reference, not longer cycles) — fail them all and fall through to the
      // normal settlement path below so the run still reports and emits "settled"
      // instead of leaving connected SSE clients hanging forever.
      for (const task of pending) failed.add(task.id);
      await emit(runId, "failed", null, { reason: "deadlock_detected", remaining: pending.map((t) => t.id) });
      break;
    }

    await Promise.all(
      runnable.map(async (task: PlanTask) => {
        if (task.depends_on.some((d) => failed.has(d))) {
          failed.add(task.id);
          await emit(runId, "failed", task.id, { reason: "dependency_failed" });
          return;
        }

        const provider = providerFor(task.capability).name;
        await emit(runId, "hired", task.id, { capability: task.capability, provider });

        try {
          const context: Record<string, unknown> = {};
          for (const dep of task.depends_on) context[dep] = results[dep];

          // A real AbortSignal, not a Promise.race — this actually cancels the
          // in-flight fetch/onchainos subprocess on timeout instead of letting a
          // real payment keep running unaccounted for in the background.
          const result = await dispatch(task, context, AbortSignal.timeout(TASK_TIMEOUT_MS));
          results[task.id] = result.payload;
          const taskCost: TaskCost = { provider: result.provider, kind: result.kind, costUsdt: result.costUsdt, paymentRef: result.paymentRef };
          costs[task.id] = taskCost;
          totalSpentUsdt += result.costUsdt;

          if (result.costUsdt > 0) {
            const paidData: Record<string, unknown> = { usdt: result.costUsdt, ref: result.paymentRef, provider: result.provider };

            // On-chain mirror (PRD §7.5, Vision Layer): a real lock+settle on
            // X Layer mainnet using Orchestra's own treasury micro-funds, keyed
            // to the real agent address CoinAnk was actually paid to. This never
            // gates the real payment above — it's a supplementary receipt, so a
            // mirror failure is recorded, not thrown; the task is still delivered.
            // Recorded on both the live event and the final report's cost table
            // (report.ts) so the "glass-box" promise holds in both surfaces.
            if (result.kind === "external_asp" && result.payTo && isEscrowConfigured()) {
              try {
                const lock = await lockTaskEscrow(runId, task.id, result.payTo);
                paidData.escrowLockTx = lock.txHash;
                taskCost.escrowLockTx = lock.txHash;
                try {
                  const settle = await settleTaskEscrow(runId, task.id);
                  paidData.escrowSettleTx = settle.txHash;
                  taskCost.escrowSettleTx = settle.txHash;
                } catch (settleErr) {
                  const message = settleErr instanceof Error ? settleErr.message : String(settleErr);
                  paidData.escrowSettleError = message;
                  taskCost.escrowError = message;
                }
              } catch (lockErr) {
                const message = lockErr instanceof Error ? lockErr.message : String(lockErr);
                paidData.escrowLockError = message;
                taskCost.escrowError = message;
              }
            }

            await emit(runId, "paid", task.id, paidData);
          }
          await emit(runId, "delivered", task.id, { provider: result.provider, kind: result.kind });
          done.add(task.id);
        } catch (err) {
          failed.add(task.id);
          const message = err instanceof Error ? err.message : String(err);
          await emit(runId, "failed", task.id, { error: message });
        }
      })
    );

    pending = pending.filter((t) => !done.has(t.id) && !failed.has(t.id));
  }

  const finalStatus = failed.size > 0 ? "failed" : "completed";
  await setRunStatus(runId, finalStatus);

  const approvedUsdt = plan.tasks.reduce((sum, t) => sum + t.max_spend_usdt, 0);
  const refundableUsdt = Math.max(0, approvedUsdt - totalSpentUsdt);

  const outcome: ExecutionOutcome = {
    results,
    costs,
    failedTasks: Array.from(failed),
    totalSpentUsdt,
    approvedUsdt,
    refundableUsdt,
  };

  const runRow = await getRun(runId);
  if (runRow) {
    const { json, markdown } = buildScoreReport(
      { id: runId, intent: String(runRow.intent), budgetUsdt: Number(runRow.budget_usdt) },
      plan,
      outcome
    );
    await saveReport(runId, json, markdown);
  }

  await emit(runId, "settled", null, {
    totalSpentUsdt,
    approvedUsdt,
    refundableUsdt,
    failedTasks: Array.from(failed),
  });

  return outcome;
}
