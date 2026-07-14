import { test } from "node:test";
import assert from "node:assert/strict";
import { routeMarketDataRequest } from "./market-data-router";

test("routes whale-flow prompts to hyper/topPosition", () => {
  const { path, query } = routeMarketDataRequest("Show me whale flows for $ETH");
  assert.equal(path, "/api/hyper/topPosition");
  assert.equal(query.baseCoin, "ETH");
  assert.equal(query.sortBy, "positionValue");
});

test("routes open interest prompts to openInterest/all", () => {
  const { path, query } = routeMarketDataRequest("What's the open interest on SOL?");
  assert.equal(path, "/api/openInterest/all");
  assert.equal(query.baseCoin, "SOL");
});

test("routes liquidation prompts to liqMap/getLiqMap", () => {
  const { path, query } = routeMarketDataRequest("liquidation risk for BTC");
  assert.equal(path, "/api/liqMap/getLiqMap");
  assert.equal(query.baseCoin, "BTC");
});

test("defaults to fundingRate/current for generic market structure prompts", () => {
  const { path, query } = routeMarketDataRequest("Full market structure brief on BTC");
  assert.equal(path, "/api/fundingRate/current");
  assert.equal(query.type, "current");
});

test("defaults coin to BTC when no known ticker is mentioned", () => {
  const { query } = routeMarketDataRequest("whale positions please");
  assert.equal(query.baseCoin, "BTC");
});

test("routes long/short sentiment prompts to longshort/realtimeAll", () => {
  const { path, query } = routeMarketDataRequest("What's the long/short sentiment on ETH?");
  assert.equal(path, "/api/longshort/realtimeAll");
  assert.equal(query.baseCoin, "ETH");
  assert.equal(query.interval, "1h");
});
