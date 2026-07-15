import { test } from "node:test";
import assert from "node:assert/strict";
import { isEscrowConfigured, taskKey } from "./escrow";

test("isEscrowConfigured is false when either env var is missing", () => {
  const savedAddr = process.env.ORCHESTRA_ESCROW_ADDRESS;
  const savedKey = process.env.DEPLOYER_PRIVATE_KEY;
  try {
    delete process.env.ORCHESTRA_ESCROW_ADDRESS;
    delete process.env.DEPLOYER_PRIVATE_KEY;
    assert.equal(isEscrowConfigured(), false);

    process.env.ORCHESTRA_ESCROW_ADDRESS = "0x5E550002e64FaF79B41D89fE8439eEb1be66CE3b";
    assert.equal(isEscrowConfigured(), false, "still false without a signing key");
  } finally {
    if (savedAddr === undefined) delete process.env.ORCHESTRA_ESCROW_ADDRESS;
    else process.env.ORCHESTRA_ESCROW_ADDRESS = savedAddr;
    if (savedKey === undefined) delete process.env.DEPLOYER_PRIVATE_KEY;
    else process.env.DEPLOYER_PRIVATE_KEY = savedKey;
  }
});

test("isEscrowConfigured is true when both env vars are set", () => {
  const savedAddr = process.env.ORCHESTRA_ESCROW_ADDRESS;
  const savedKey = process.env.DEPLOYER_PRIVATE_KEY;
  try {
    process.env.ORCHESTRA_ESCROW_ADDRESS = "0x5E550002e64FaF79B41D89fE8439eEb1be66CE3b";
    process.env.DEPLOYER_PRIVATE_KEY = "0x1d3694721e2fd42f9edf1fa129d54f64fb6a32c3eb6a7c4c6bf0c5e2e6ba3d87";
    assert.equal(isEscrowConfigured(), true);
  } finally {
    if (savedAddr === undefined) delete process.env.ORCHESTRA_ESCROW_ADDRESS;
    else process.env.ORCHESTRA_ESCROW_ADDRESS = savedAddr;
    if (savedKey === undefined) delete process.env.DEPLOYER_PRIVATE_KEY;
    else process.env.DEPLOYER_PRIVATE_KEY = savedKey;
  }
});

test("taskKey is a 32-byte hex value", () => {
  const key = taskKey("run-1", "t1");
  assert.match(key, /^0x[0-9a-f]{64}$/);
});

test("taskKey distinguishes the same task id across different runs (planner ids only guarantee per-run uniqueness)", () => {
  const keyRun1 = taskKey("run-1", "t1");
  const keyRun2 = taskKey("run-2", "t1");
  assert.notEqual(keyRun1, keyRun2, "the same plan task id in two different runs must not collide on-chain");
});

test("taskKey is deterministic for the same run+task pair", () => {
  assert.equal(taskKey("run-1", "t1"), taskKey("run-1", "t1"));
});
