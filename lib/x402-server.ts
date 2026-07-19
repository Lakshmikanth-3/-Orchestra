import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { x402ResourceServer } from "@okxweb3/x402-next";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";

export const XLAYER_NETWORK = "eip155:196";
export const RUN_PRICE_USD = "$0.5";

/**
 * The x402 SDK falls back to the raw incoming request's own URL for the
 * `resource.url` field in its 402 challenge when this isn't set -- which,
 * behind Render's reverse proxy, reports the container's internal address
 * (e.g. http://localhost:10000) rather than the real public one. Any caller
 * that treats `resource.url` as the identity of the paid resource (which is
 * exactly what an x402 validator does) would find that address unreachable.
 */
export function orchestrateResourceUrl(): string | undefined {
  const base = process.env.ORCHESTRA_PUBLIC_URL;
  return base ? `${base.replace(/\/$/, "")}/api/orchestrate` : undefined;
}

export function facilitatorCredsConfigured(): boolean {
  // ORCHESTRA_AGENTIC_WALLET is included here, not just the OKX creds: it's
  // the accepts.payTo recipient for every inbound payment. Without it the
  // gate would otherwise pass this check and hand withX402 an undefined
  // payTo instead of failing with a clear, explicit error.
  return Boolean(
    process.env.OKX_API_KEY &&
      process.env.OKX_SECRET_KEY &&
      process.env.OKX_PASSPHRASE &&
      process.env.ORCHESTRA_AGENTIC_WALLET
  );
}

let server: x402ResourceServer | null = null;

/** Real OKX facilitator-backed resource server for Orchestra's inbound x402 gate. */
export function getResourceServer(): x402ResourceServer {
  if (server) return server;
  if (!facilitatorCredsConfigured()) {
    throw new Error(
      "OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE are not set — apply at https://web3.okx.com/onchainos/dev-portal"
    );
  }
  const facilitatorClient = new OKXFacilitatorClient({
    apiKey: process.env.OKX_API_KEY!,
    secretKey: process.env.OKX_SECRET_KEY!,
    passphrase: process.env.OKX_PASSPHRASE!,
  });
  server = new x402ResourceServer(facilitatorClient).register(XLAYER_NETWORK, new ExactEvmScheme());
  return server;
}
