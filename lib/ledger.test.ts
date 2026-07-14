import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDbPath = path.join(os.tmpdir(), `orchestra-ledger-test-${Date.now()}.db`);
process.env.ORCHESTRA_DB_PATH = tmpDbPath;

let createRun: typeof import("./ledger").createRun;
let appendEvent: typeof import("./ledger").appendEvent;
let getEvents: typeof import("./ledger").getEvents;
let getRun: typeof import("./ledger").getRun;
let saveReport: typeof import("./ledger").saveReport;
let setRunStatus: typeof import("./ledger").setRunStatus;
let closeDb: typeof import("./ledger").closeDb;

before(async () => {
  const ledger = await import("./ledger");
  ({ createRun, appendEvent, getEvents, getRun, saveReport, setRunStatus, closeDb } = ledger);
  await createRun("run-1", "test intent", 1, "operator_key");
});

after(async () => {
  closeDb();
  // Windows can hold the file handle open briefly after close() returns;
  // this is a test-cleanup artifact, not a product bug, so retry gently
  // and fall back to leaving the (uniquely-named, OS-temp-dir) file behind.
  for (const f of [tmpDbPath, `${tmpDbPath}-shm`, `${tmpDbPath}-wal`]) {
    for (let attempt = 0; attempt < 5 && fs.existsSync(f); attempt++) {
      try {
        fs.rmSync(f);
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
});

test("createRun + getRun round-trips real data", async () => {
  const run = await getRun("run-1");
  assert.ok(run);
  assert.equal(run!.intent, "test intent");
  assert.equal(run!.budget_usdt, 1);
  assert.equal(run!.status, "planning");
  assert.equal(run!.paid_via, "operator_key");
});

test("getRun returns null for an unknown run", async () => {
  const run = await getRun("does-not-exist");
  assert.equal(run, null);
});

test("appendEvent persists and getEvents retrieves in order", async () => {
  await appendEvent("run-1", "hired", "t1", { capability: "market_data" });
  await appendEvent("run-1", "paid", "t1", { usdt: 0.05 });
  const events = await getEvents("run-1");
  assert.ok(events.length >= 2);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("hired"));
  assert.ok(types.includes("paid"));
  assert.equal(events[0].runId, "run-1");
});

test("getEvents(afterId) only returns newer events", async () => {
  const all = await getEvents("run-1");
  const firstId = all[0].id;
  const after = await getEvents("run-1", firstId);
  assert.ok(after.every((e) => e.id > firstId));
  assert.equal(after.length, all.length - 1);
});

test("setRunStatus updates the run's status", async () => {
  await setRunStatus("run-1", "completed");
  const run = await getRun("run-1");
  assert.equal(run!.status, "completed");
});

test("saveReport persists JSON + Markdown that round-trip", async () => {
  const reportJson = { runId: "run-1", totalSpentUsdt: 0.05 };
  await saveReport("run-1", reportJson, "# Report\nhello");
  const run = await getRun("run-1");
  assert.deepEqual(JSON.parse(String(run!.report_json)), reportJson);
  assert.equal(run!.report_markdown, "# Report\nhello");
});
