import { test } from "node:test";
import assert from "node:assert/strict";
import { facilitatorCredsConfigured } from "./x402-server";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) saved[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("facilitatorCredsConfigured is false when ORCHESTRA_AGENTIC_WALLET is missing, even with all OKX creds set (regression: payTo used to go through as undefined instead of failing loud)", () => {
  withEnv(
    { OKX_API_KEY: "k", OKX_SECRET_KEY: "s", OKX_PASSPHRASE: "p", ORCHESTRA_AGENTIC_WALLET: undefined },
    () => {
      assert.equal(facilitatorCredsConfigured(), false);
    }
  );
});

test("facilitatorCredsConfigured is false when only some OKX creds are set", () => {
  withEnv(
    { OKX_API_KEY: "k", OKX_SECRET_KEY: undefined, OKX_PASSPHRASE: "p", ORCHESTRA_AGENTIC_WALLET: "0xabc" },
    () => {
      assert.equal(facilitatorCredsConfigured(), false);
    }
  );
});

test("facilitatorCredsConfigured is true when every required value is set", () => {
  withEnv(
    { OKX_API_KEY: "k", OKX_SECRET_KEY: "s", OKX_PASSPHRASE: "p", ORCHESTRA_AGENTIC_WALLET: "0xabc" },
    () => {
      assert.equal(facilitatorCredsConfigured(), true);
    }
  );
});
