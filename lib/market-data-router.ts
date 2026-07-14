const KNOWN_COINS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "ADA", "AVAX", "LINK", "OKB", "SUI"];

function extractCoin(prompt: string): string {
  const dollarMatch = prompt.match(/\$([A-Za-z]{2,10})\b/);
  if (dollarMatch) return dollarMatch[1].toUpperCase();
  const upper = prompt.toUpperCase();
  for (const coin of KNOWN_COINS) {
    if (upper.includes(coin)) return coin;
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
  return { path: "/api/fundingRate/current", query: { type: "current" } };
}
