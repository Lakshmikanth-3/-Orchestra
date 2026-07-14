import type { Plan, PlanTask } from "./schema";
import { dispatch } from "./dispatch";
import { appendEvent, setRunStatus, saveReport, getRun } from "./ledger";
import { publish } from "./bus";
import { buildScoreReport } from "./report";

const TASK_TIMEOUT_MS = 60_000;

async function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`task timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function emit(
  runId: string,
  type: Parameters<typeof appendEvent>[1],
  taskId: string | null,
  data: Record<string, unknown>
): Promise<void> {
  const event = await appendEvent(runId, type, taskId, data);
  publish(runId, event);
}

export interface ExecutionOutcome {
  results: Record<string, unknown>;
  costs: Record<string, { provider: string; kind: string; costUsdt: number; paymentRef: string }>;
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
      await emit(runId, "failed", null, { reason: "deadlock_detected", remaining: pending.map((t) => t.id) });
      await setRunStatus(runId, "failed");
      throw new Error("deadlock_detected: remaining tasks have unresolved dependencies");
    }

    await Promise.all(
      runnable.map(async (task: PlanTask) => {
        if (task.depends_on.some((d) => failed.has(d))) {
          failed.add(task.id);
          await emit(runId, "failed", task.id, { reason: "dependency_failed" });
          return;
        }

        const provider = task.capability === "market_data" ? "CoinAnk" : "Orchestra internal skill";
        await emit(runId, "hired", task.id, { capability: task.capability, provider });

        try {
          const context: Record<string, unknown> = {};
          for (const dep of task.depends_on) context[dep] = results[dep];

          const result = await withTimeout(TASK_TIMEOUT_MS, dispatch(task, context));
          results[task.id] = result.payload;
          costs[task.id] = { provider: result.provider, kind: result.kind, costUsdt: result.costUsdt, paymentRef: result.paymentRef };
          totalSpentUsdt += result.costUsdt;

          if (result.costUsdt > 0) {
            await emit(runId, "paid", task.id, { usdt: result.costUsdt, ref: result.paymentRef, provider: result.provider });
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
