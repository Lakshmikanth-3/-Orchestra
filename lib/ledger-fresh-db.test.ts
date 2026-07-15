// Regression test: every read/write entry point must self-heal the schema,
// not just createRun. Needs its own fresh ORCHESTRA_DB_PATH/module singleton
// (separate from ledger.test.ts) so nothing has called migrate() yet when
// these assertions run.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDbPath = path.join(os.tmpdir(), `orchestra-ledger-freshdb-test-${Date.now()}.db`);
process.env.ORCHESTRA_DB_PATH = tmpDbPath;

after(async () => {
  const { closeDb } = await import("./ledger");
  closeDb();
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

test("getEvents on a brand-new db (before any createRun) self-heals instead of throwing 'no such table'", async () => {
  const { getEvents } = await import("./ledger");
  const events = await getEvents("no-such-run-yet");
  assert.deepEqual(events, []);
});

test("getRun on a brand-new db self-heals instead of throwing 'no such table'", async () => {
  const { getRun } = await import("./ledger");
  const run = await getRun("no-such-run-yet");
  assert.equal(run, null);
});
