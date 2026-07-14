import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScoreReport } from "./report";
import { PlanSchema } from "./schema";
import type { ExecutionOutcome } from "./executor";

const run = { id: "run-1", intent: "test intent", budgetUsdt: 1 };

test("a failed market_data task reports kind=external_asp, never 'internal' (regression for the report mislabeling bug)", () => {
  const plan = PlanSchema.parse({
    tasks: [{ id: "t1", capability: "market_data", prompt: "p", depends_on: [], max_spend_usdt: 0.1 }],
  });
  const outcome: ExecutionOutcome = {
    results: {},
    costs: {}, // task failed before a cost entry was ever recorded
    failedTasks: ["t1"],
    totalSpentUsdt: 0,
    approvedUsdt: 0.1,
    refundableUsdt: 0.1,
  };

  const { json, markdown } = buildScoreReport(run, plan, outcome);

  assert.equal(json.sections[0].kind, "external_asp");
  assert.equal(json.sections[0].provider, "CoinAnk");
  assert.equal(json.sections[0].status, "failed");
  assert.ok(markdown.includes("External ASP — CoinAnk"));
  assert.ok(!markdown.includes("Internal skill — CoinAnk"), "must never show the self-contradictory label");
});

test("a failed internal task reports kind=internal", () => {
  const plan = PlanSchema.parse({
    tasks: [{ id: "t1", capability: "risk_flags", prompt: "p", depends_on: [], max_spend_usdt: 0 }],
  });
  const outcome: ExecutionOutcome = {
    results: {},
    costs: {},
    failedTasks: ["t1"],
    totalSpentUsdt: 0,
    approvedUsdt: 0,
    refundableUsdt: 0,
  };

  const { json } = buildScoreReport(run, plan, outcome);
  assert.equal(json.sections[0].kind, "internal");
  assert.equal(json.sections[0].provider, "Orchestra internal skill");
});

test("a delivered market_data task reports the real recorded cost and payment ref", () => {
  const plan = PlanSchema.parse({
    tasks: [{ id: "t1", capability: "market_data", prompt: "p", depends_on: [], max_spend_usdt: 0.1 }],
  });
  const outcome: ExecutionOutcome = {
    results: { t1: { some: "payload" } },
    costs: { t1: { provider: "CoinAnk", kind: "external_asp", costUsdt: 0.001, paymentRef: "abc123" } },
    failedTasks: [],
    totalSpentUsdt: 0.001,
    approvedUsdt: 0.1,
    refundableUsdt: 0.099,
  };

  const { json, markdown } = buildScoreReport(run, plan, outcome);
  assert.equal(json.sections[0].status, "delivered");
  assert.equal(json.sections[0].costUsdt, 0.001);
  assert.equal(json.sections[0].paymentRef, "abc123");
  assert.ok(markdown.includes("0.001"));
  assert.ok(markdown.includes("abc123"));
});

test("totals and refundable budget surface correctly in both json and markdown", () => {
  const plan = PlanSchema.parse({
    tasks: [{ id: "t1", capability: "synthesize_report", prompt: "p", depends_on: [], max_spend_usdt: 0 }],
  });
  const outcome: ExecutionOutcome = {
    results: { t1: { text: "done", citedUrls: [] } },
    costs: { t1: { provider: "Orchestra internal skill", kind: "internal", costUsdt: 0, paymentRef: "internal" } },
    failedTasks: [],
    totalSpentUsdt: 0.5,
    approvedUsdt: 0.6,
    refundableUsdt: 0.1,
  };

  const { json, markdown } = buildScoreReport({ ...run, budgetUsdt: 1 }, plan, outcome);
  assert.equal(json.status, "completed");
  assert.equal(json.totalSpentUsdt, 0.5);
  assert.equal(json.refundableUsdt, 0.1);
  assert.ok(markdown.includes("Total spent:** 0.5 USDT of 0.6 USDT approved"));
  assert.ok(markdown.includes("Refundable:** 0.1 USDT"));
});

test("failed sections never render fabricated content", () => {
  const plan = PlanSchema.parse({
    tasks: [{ id: "t1", capability: "news_scan", prompt: "p", depends_on: [], max_spend_usdt: 0 }],
  });
  const outcome: ExecutionOutcome = {
    results: {},
    costs: {},
    failedTasks: ["t1"],
    totalSpentUsdt: 0,
    approvedUsdt: 0,
    refundableUsdt: 0,
  };

  const { json, markdown } = buildScoreReport(run, plan, outcome);
  assert.equal(json.sections[0].content, null);
  assert.ok(markdown.includes("nothing here is fabricated"));
});
