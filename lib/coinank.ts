import { createHash } from "node:crypto";
import { payX402, chargeX402 } from "./onchainos";
import { atomicToHuman } from "./token-decimals";

const COINANK_BASE_URL = "https://open-api.coinank.com";

export class CoinAnkError extends Error {}

export interface CoinAnkCallResult {
  payload: unknown;
  costUsdt: number;
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

interface WwwAuthenticateChallenge {
  amount: string;
  currency: string;
  chainId: number;
}

/** Parses `Payment id="...", request="<base64url>", ...` and decodes the real amount/currency/chainId it carries. */
function decodeWwwAuthenticate(headerValue: string): WwwAuthenticateChallenge {
  const match = headerValue.match(/request="([^"]+)"/);
  if (!match) {
    throw new CoinAnkError(`WWW-Authenticate header has no request= field: ${headerValue}`);
  }
  const json = Buffer.from(match[1], "base64url").toString("utf8");
  const parsed = JSON.parse(json);
  return { amount: parsed.amount, currency: parsed.currency, chainId: parsed.methodDetails?.chainId };
}

/** A payment reference derived from the full authorization header (not a truncated prefix, which x402 headers often share). */
function derivePaymentRef(authorizationHeader: string): string {
  return createHash("sha256").update(authorizationHeader).digest("hex").slice(0, 16);
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
  maxSpendUsdt = Infinity,
  signal?: AbortSignal
): Promise<CoinAnkCallResult> {
  const url = new URL(path, COINANK_BASE_URL);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const first = await fetch(url, { method: "GET", signal });

  if (first.status !== 402) {
    if (!first.ok) {
      throw new CoinAnkError(`CoinAnk ${path} returned HTTP ${first.status}: ${await first.text()}`);
    }
    return { payload: await first.json(), costUsdt: 0, paymentRef: "free_tier" };
  }

  const paymentRequiredHeader = first.headers.get("Payment-Required");
  const wwwAuthenticate = first.headers.get("WWW-Authenticate");

  if (paymentRequiredHeader) {
    const decoded = decodePaymentRequired(paymentRequiredHeader);
    if (decoded.accepts.length === 0) {
      throw new CoinAnkError(`CoinAnk ${path} returned a Payment-Required header with an empty accepts[] — no payable option offered`);
    }
    const option = decoded.accepts.find((a) => a.scheme === "exact") ?? decoded.accepts[0];
    const humanAmount = await atomicToHuman(option.amount, option.asset, option.network);
    if (humanAmount > maxSpendUsdt) {
      throw new CoinAnkError(
        `CoinAnk ${path} price ${humanAmount} exceeds this task's approved cap of ${maxSpendUsdt} — refusing to pay`
      );
    }
    const selectedIndex = decoded.accepts.indexOf(option);
    const { authorizationHeader, headerName } = await payX402(paymentRequiredHeader, selectedIndex, signal);
    const replay = await fetch(url, { method: "GET", headers: { [headerName]: authorizationHeader }, signal });
    if (!replay.ok) {
      throw new CoinAnkError(`CoinAnk ${path} replay after payment failed: HTTP ${replay.status}: ${await replay.text()}`);
    }
    return {
      payload: await replay.json(),
      costUsdt: humanAmount,
      paymentRef: derivePaymentRef(authorizationHeader),
    };
  }

  if (wwwAuthenticate?.startsWith("Payment ")) {
    const challenge = decodeWwwAuthenticate(wwwAuthenticate);
    const humanAmount = await atomicToHuman(challenge.amount, challenge.currency, `eip155:${challenge.chainId}`);
    if (humanAmount > maxSpendUsdt) {
      throw new CoinAnkError(
        `CoinAnk ${path} price ${humanAmount} exceeds this task's approved cap of ${maxSpendUsdt} — refusing to pay`
      );
    }
    const { authorizationHeader, headerName } = await chargeX402(wwwAuthenticate, signal);
    const replay = await fetch(url, { method: "GET", headers: { [headerName]: authorizationHeader }, signal });
    if (!replay.ok) {
      throw new CoinAnkError(`CoinAnk ${path} replay after payment failed: HTTP ${replay.status}: ${await replay.text()}`);
    }
    return {
      payload: await replay.json(),
      costUsdt: humanAmount,
      paymentRef: derivePaymentRef(authorizationHeader),
    };
  }

  throw new CoinAnkError(`CoinAnk ${path} returned 402 with no recognized payment challenge`);
}
