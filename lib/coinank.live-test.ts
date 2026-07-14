// Real network integration test against the live CoinAnk API. Kept out of
// `pnpm test` (which must stay fast and hermetic) — run explicitly with
// `pnpm test:live`. No credentials needed: the budget cap rejects the real
// price before any payment is attempted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { callCoinAnk, CoinAnkError } from "./coinank";

test("callCoinAnk rejects a real CoinAnk price that exceeds the task's approved cap", async () => {
  await assert.rejects(
    () => callCoinAnk("/api/fundingRate/current", { type: "current" }, 0.0000001),
    (err: unknown) => {
      assert.ok(err instanceof CoinAnkError);
      assert.match(err.message, /exceeds this task's approved cap/);
      return true;
    }
  );
});
