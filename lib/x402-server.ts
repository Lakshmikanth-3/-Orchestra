import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { x402ResourceServer } from "@okxweb3/x402-next";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";

export const XLAYER_NETWORK = "eip155:196";
export const RUN_PRICE_USD = "$0.5";

export function facilitatorCredsConfigured(): boolean {
  return Boolean(process.env.OKX_API_KEY && process.env.OKX_SECRET_KEY && process.env.OKX_PASSPHRASE);
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
