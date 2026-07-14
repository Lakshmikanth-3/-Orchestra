import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePaymentRequired, decodeWwwAuthenticate, derivePaymentRef } from "./coinank";

// This is a REAL Payment-Required header, captured verbatim from a live
// GET https://open-api.coinank.com/api/fundingRate/current?type=current
// during this session (curl -D headers.txt) — not synthetic test data.
const REAL_PAYMENT_REQUIRED_HEADER =
  "eyJ4NDAyVmVyc2lvbiI6MiwiYWNjZXB0cyI6W3sieDQwMlZlcnNpb24iOjIsInNjaGVtZSI6ImV4YWN0IiwibmV0d29yayI6ImVpcDE1NToxOTYiLCJhbW91bnQiOiIxMDAwIiwiYXNzZXQiOiIweDRhZTQ2YTUwOWY2YjFkOTA1NjkzN2JhNDUwMGNiMTQzOTMzZDJkYzgiLCJwYXlUbyI6IjB4YjEyNTdlNzU3OTFiYWEzNjY0NjExM2Q4YjFmZGZjODNiM2UyZDBiNyIsIm1heFRpbWVvdXRTZWNvbmRzIjozMDAsImV4dHJhIjp7Im5hbWUiOiJHbG9iYWwgRG9sbGFyIiwidmVyc2lvbiI6IjEifX0seyJ4NDAyVmVyc2lvbiI6Miwic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1OjE5NiIsImFtb3VudCI6IjEwMDAiLCJhc3NldCI6IjB4Nzc5ZGVkMGM5ZTEwMjIyMjVmOGUwNjMwYjM1YTliNTRiZTcxMzczNiIsInBheVRvIjoiMHhiMTI1N2U3NTc5MWJhYTM2NjQ2MTEzZDhiMWZkZmM4M2IzZTJkMGI3IiwibWF4VGltZW91dFNlY29uZHMiOjMwMCwiZXh0cmEiOnsibmFtZSI6IlVTROKCrjAiLCJ2ZXJzaW9uIjoiMSJ9fSx7Ing0MDJWZXJzaW9uIjoyLCJzY2hlbWUiOiJhZ2dyX2RlZmVycmVkIiwibmV0d29yayI6ImVpcDE1NToxOTYiLCJhbW91bnQiOiIxMDAwIiwiYXNzZXQiOiIweDRhZTQ2YTUwOWY2YjFkOTA1NjkzN2JhNDUwMGNiMTQzOTMzZDJkYzgiLCJwYXlUbyI6IjB4YjEyNTdlNzU3OTFiYWEzNjY0NjExM2Q4YjFmZGZjODNiM2UyZDBiNyIsIm1heFRpbWVvdXRTZWNvbmRzIjozMDAsImV4dHJhIjp7Im5hbWUiOiJHbG9iYWwgRG9sbGFyIiwidmVyc2lvbiI6IjEifX0seyJ4NDAyVmVyc2lvbiI6Miwic2NoZW1lIjoiYWdncl9kZWZlcnJlZCIsIm5ldHdvcmsiOiJlaXAxNTU6MTk2IiwiYW1vdW50IjoiMTAwMCIsImFzc2V0IjoiMHg3NzlkZWQwYzllMTAyMjIyNWY4ZTA2MzBiMzVhOWI1NGJlNzEzNzM2IiwicGF5VG8iOiIweGIxMjU3ZTc1NzkxYmFhMzY2NDYxMTNkOGIxZmRmYzgzYjNlMmQwYjciLCJtYXhUaW1lb3V0U2Vjb25kcyI6MzAwLCJleHRyYSI6eyJuYW1lIjoiVVNE4oKuMCIsInZlcnNpb24iOiIxIn19XSwicmVzb3VyY2UiOnsidXJsIjoiaHR0cHM6Ly9vcGVuLWFwaS5jb2luYW5rLmNvbS9hcGkvZnVuZGluZ1JhdGUvY3VycmVudCJ9fQ==";

// A REAL WWW-Authenticate header, also captured live from the same endpoint.
const REAL_WWW_AUTHENTICATE_HEADER =
  'Payment id="fae621ee16194dcaa6eb68", realm="open-api.coinank.com", method="evm", intent="charge", request="eyJhbW91bnQiOiIxMDAwIiwiY3VycmVuY3kiOiIweDRhZTQ2YTUwOWY2YjFkOTA1NjkzN2JhNDUwMGNiMTQzOTMzZDJkYzgiLCJyZWNpcGllbnQiOiIweGIxMjU3ZTc1NzkxYmFhMzY2NDYxMTNkOGIxZmRmYzgzYjNlMmQwYjciLCJtZXRob2REZXRhaWxzIjp7ImNoYWluSWQiOjE5NiwiZmVlUGF5ZXIiOnRydWV9fQ", expires="2026-07-14T19:51:51.363092132Z"';

test("decodePaymentRequired parses the real CoinAnk accepts[] shape", () => {
  const decoded = decodePaymentRequired(REAL_PAYMENT_REQUIRED_HEADER);
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.accepts.length, 4);
  assert.equal(decoded.accepts[0].scheme, "exact");
  assert.equal(decoded.accepts[0].network, "eip155:196");
  assert.equal(decoded.accepts[0].amount, "1000");
  assert.equal(decoded.accepts[0].asset, "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8");
  assert.equal(decoded.resource?.url, "https://open-api.coinank.com/api/fundingRate/current");
});

test("decodePaymentRequired throws on truncated/invalid base64 JSON rather than silently returning garbage", () => {
  assert.throws(() => decodePaymentRequired("not-valid-base64-json!!!"));
});

test("decodeWwwAuthenticate extracts the real amount/currency/chainId from the request= field", () => {
  const challenge = decodeWwwAuthenticate(REAL_WWW_AUTHENTICATE_HEADER);
  assert.equal(challenge.amount, "1000");
  assert.equal(challenge.currency, "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8");
  assert.equal(challenge.chainId, 196);
});

test("decodeWwwAuthenticate throws a clean error when request= is missing", () => {
  assert.throws(() => decodeWwwAuthenticate('Payment id="abc", realm="x"'), /no request= field/);
});

test("derivePaymentRef is deterministic and distinguishes different headers", () => {
  const ref1 = derivePaymentRef("header-a");
  const ref2 = derivePaymentRef("header-a");
  const ref3 = derivePaymentRef("header-b");
  assert.equal(ref1, ref2);
  assert.notEqual(ref1, ref3);
});

test("derivePaymentRef does not collide on headers sharing a long common prefix (the bug it replaced)", () => {
  // Simulates the real risk: x402 auth headers often share a structural
  // prefix (same scheme/version fields) — the old slice(0, 32) approach
  // would have collided on inputs like this.
  const prefix = "eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6MTk2Ijo";
  const ref1 = derivePaymentRef(prefix + "aaaa-signature-one");
  const ref2 = derivePaymentRef(prefix + "bbbb-signature-two");
  assert.notEqual(ref1, ref2);
});
