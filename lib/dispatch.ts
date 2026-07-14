import type { PlanTask } from "./schema";
import { providerFor } from "./registry";
import { callCoinAnk } from "./coinank";
import { routeMarketDataRequest } from "./market-data-router";
import { runInternalSkill } from "./skills";

export interface DispatchResult {
  taskId: string;
  provider: string;
  kind: "external_asp" | "internal";
  payload: unknown;
  costUsdt: number;
  paymentRef: string;
}

/**
 * Executes one plan task for real: pays and calls the live CoinAnk ASP for
 * market_data, or runs the matching internal Claude-backed skill otherwise.
 * Never fabricates a payload, a payment reference, or a cost.
 */
export async function dispatch(task: PlanTask, context: Record<string, unknown>, signal?: AbortSignal): Promise<DispatchResult> {
  const provider = providerFor(task.capability);

  if (task.capability === "market_data") {
    const { path, query } = routeMarketDataRequest(task.prompt);
    const result = await callCoinAnk(path, query, task.max_spend_usdt, signal);
    return {
      taskId: task.id,
      provider: provider.name,
      kind: "external_asp",
      payload: result.payload,
      costUsdt: result.costUsdt,
      paymentRef: result.paymentRef,
    };
  }

  const skillOutput = await runInternalSkill(task.capability, task.prompt, context);
  return {
    taskId: task.id,
    provider: provider.name,
    kind: "internal",
    payload: skillOutput,
    costUsdt: 0,
    paymentRef: "internal",
  };
}
