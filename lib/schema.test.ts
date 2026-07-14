import { test } from "node:test";
import assert from "node:assert/strict";
import { PlanSchema, validatePlanBudget } from "./schema";

test("validatePlanBudget passes for a plan within 60% of budget", () => {
  const plan = PlanSchema.parse({
    tasks: [
      { id: "t1", capability: "market_data", prompt: "p", depends_on: [], max_spend_usdt: 0.3 },
      { id: "t2", capability: "synthesize_report", prompt: "p", depends_on: ["t1"], max_spend_usdt: 0 },
    ],
  });
  assert.doesNotThrow(() => validatePlanBudget(plan, 1));
});

test("validatePlanBudget rejects a plan exceeding 60% of budget", () => {
  const plan = PlanSchema.parse({
    tasks: [{ id: "t1", capability: "market_data", prompt: "p", depends_on: [], max_spend_usdt: 0.7 }],
  });
  assert.throws(() => validatePlanBudget(plan, 1), /exceeds budget cap/);
});

test("validatePlanBudget rejects an unknown depends_on reference", () => {
  const plan = PlanSchema.parse({
    tasks: [{ id: "t1", capability: "market_data", prompt: "p", depends_on: ["ghost"], max_spend_usdt: 0 }],
  });
  assert.throws(() => validatePlanBudget(plan, 1), /unknown task id/);
});

test("validatePlanBudget rejects a task depending on itself", () => {
  const plan = PlanSchema.parse({
    tasks: [{ id: "t1", capability: "market_data", prompt: "p", depends_on: ["t1"], max_spend_usdt: 0 }],
  });
  assert.throws(() => validatePlanBudget(plan, 1), /cannot depend on itself/);
});

test("PlanSchema rejects more than 6 tasks", () => {
  const tasks = Array.from({ length: 7 }, (_, i) => ({
    id: `t${i}`,
    capability: "synthesize_report" as const,
    prompt: "p",
    depends_on: [],
    max_spend_usdt: 0,
  }));
  assert.throws(() => PlanSchema.parse({ tasks }));
});
