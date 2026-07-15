const KNOWN_COINS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "ADA", "AVAX", "LINK", "OKB", "SUI"];

function extractCoin(prompt: string): string {
  const dollarMatch = prompt.match(/\$([A-Za-z]{2,10})\b/);
  if (dollarMatch) return dollarMatch[1].toUpperCase();
  const upper = prompt.toUpperCase();
  for (const coin of KNOWN_COINS) {
    // Word-boundary match, not a plain substring check — "CANADA" contains
    // "ADA" and "SUITE" contains "SUI", which would otherwise silently route
    // a real paid CoinAnk call to the wrong asset.
    if (new RegExp(`\\b${coin}\\b`).test(upper)) return coin;
  }
  return "BTC";
}

export interface CoinAnkRequest {
  path: string;
  query: Record<string, string>;
}

/**
 * Routes a market_data task's free-text prompt to one of CoinAnk's real,
 * documented endpoints (see ~/.agents/skills/coinank-openapi/references).
 * Deterministic keyword routing — no LLM guess at the endpoint shape.
 */
export function routeMarketDataRequest(prompt: string): CoinAnkRequest {
  const lower = prompt.toLowerCase();
  const coin = extractCoin(prompt);

  if (lower.includes("fund flow") || lower.includes("capital flow") || lower.includes("net flow") || lower.includes("inflow") || lower.includes("outflow")) {
    return {
      path: "/api/fund/fundReal",
      query: { productType: "SWAP", page: "1", size: "50", sortBy: "h1net", sortType: "desc", baseCoin: coin },
    };
  }
  if (lower.includes("whale") || lower.includes("position")) {
    return {
      path: "/api/hyper/topPosition",
      query: { sortBy: "positionValue", sortType: "desc", page: "1", size: "50", baseCoin: coin },
    };
  }
  if (lower.includes("open interest")) {
    return { path: "/api/openInterest/all", query: { baseCoin: coin } };
  }
  if (lower.includes("liquidation")) {
    return { path: "/api/liqMap/getLiqMap", query: { baseCoin: coin } };
  }
  if (lower.includes("long") || lower.includes("short") || lower.includes("sentiment")) {
    return { path: "/api/longshort/realtimeAll", query: { baseCoin: coin, interval: "1h" } };
  }
  return { path: "/api/fundingRate/current", query: { type: "current" } };
}
