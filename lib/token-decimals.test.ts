import { test } from "node:test";
import assert from "node:assert/strict";
import { atomicToHuman } from "./token-decimals";

test("atomicToHuman throws instead of silently returning 0 when amount is missing (regression: used to mask a real unknown-sized payment as $0)", async () => {
  await assert.rejects(
    () => atomicToHuman("", "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8", "eip155:196"),
    /missing amount/
  );
});

test("atomicToHuman throws instead of silently returning 0 when the token address is missing", async () => {
  await assert.rejects(() => atomicToHuman("1000", "", "eip155:196"), /missing amount/);
});

test("atomicToHuman throws when network is missing instead of silently defaulting to X Layer", async () => {
  await assert.rejects(
    () => atomicToHuman("1000", "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8", ""),
    /unsupported or missing network/
  );
});

test("atomicToHuman throws when network doesn't match X Layer", async () => {
  await assert.rejects(
    () => atomicToHuman("1000", "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8", "eip155:1"),
    /unsupported or missing network/
  );
});
