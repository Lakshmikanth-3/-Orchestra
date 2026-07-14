import { payX402, chargeX402 } from "./onchainos";
import { atomicToHuman } from "./token-decimals";

const COINANK_BASE_URL = "https://open-api.coinank.com";

export class CoinAnkError extends Error {}

export interface CoinAnkCallResult {
  payload: unknown;
  costAtomic: string;
  asset: string;
  network: string;
  paymentRef: string;
}

interface DecodedAccepts {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
  }>;
  resource?: { url: string };
}

function decodePaymentRequired(headerValue: string): DecodedAccepts {
  const json = Buffer.from(headerValue, "base64").toString("utf8");
  return JSON.parse(json);
}

/**
 * Calls a real CoinAnk endpoint. On a real HTTP 402, pays via the already
 * logged-in Agentic Wallet through onchainos, then replays the exact same
 * request with the returned authorization header. Never fabricates a
 * payment or a payload — every field here comes from CoinAnk's real response.
 */
export async function callCoinAnk(
  path: string,
  query: Record<string, string> = {},
  maxSpendUsdt = Infinity
): Promise<CoinAnkCallResult> {
  const url = new URL(path, COINANK_BASE_URL);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const first = await fetch(url, { method: "GET" });

  if (first.status !== 402) {
    if (!first.ok) {
      throw new CoinAnkError(`CoinAnk ${path} returned HTTP ${first.status}: ${await first.text()}`);
    }
    return { payload: await first.json(), costAtomic: "0", asset: "", network: "", paymentRef: "free_tier" };
  }

  const paymentRequiredHeader = first.headers.get("Payment-Required");
  const wwwAuthenticate = first.headers.get("WWW-Authenticate");

  if (paymentRequiredHeader) {
    const decoded = decodePaymentRequired(paymentRequiredHeader);
    const option = decoded.accepts.find((a) => a.scheme === "exact") ?? decoded.accepts[0];
    const humanAmount = await atomicToHuman(option.amount, option.asset);
    if (humanAmount > maxSpendUsdt) {
      throw new CoinAnkError(
        `CoinAnk ${path} price ${humanAmount} exceeds this task's approved cap of ${maxSpendUsdt} — refusing to pay`
      );
    }
    const selectedIndex = decoded.accepts.indexOf(option);
    const { authorizationHeader, headerName } = await payX402(paymentRequiredHeader, selectedIndex);
    const replay = await fetch(url, { method: "GET", headers: { [headerName]: authorizationHeader } });
    if (!replay.ok) {
      throw new CoinAnkError(`CoinAnk ${path} replay after payment failed: HTTP ${replay.status}: ${await replay.text()}`);
    }
    return {
      payload: await replay.json(),
      costAtomic: option.amount,
      asset: option.asset,
      network: option.network,
      paymentRef: authorizationHeader.slice(0, 32),
    };
  }

  if (wwwAuthenticate?.startsWith("Payment ")) {
    const { authorizationHeader, headerName } = await chargeX402(wwwAuthenticate);
    const replay = await fetch(url, { method: "GET", headers: { [headerName]: authorizationHeader } });
    if (!replay.ok) {
      throw new CoinAnkError(`CoinAnk ${path} replay after payment failed: HTTP ${replay.status}: ${await replay.text()}`);
    }
    return {
      payload: await replay.json(),
      costAtomic: "",
      asset: "",
      network: "",
      paymentRef: authorizationHeader.slice(0, 32),
    };
  }

  throw new CoinAnkError(`CoinAnk ${path} returned 402 with no recognized payment challenge`);
}
