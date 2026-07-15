import { createPublicClient, http, erc20Abi } from "viem";

const XLAYER_RPC = "https://rpc.xlayer.tech";
const XLAYER_NETWORK = "eip155:196";

const client = createPublicClient({
  chain: { id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [XLAYER_RPC] } } },
  transport: http(XLAYER_RPC),
});

const cache = new Map<string, number>();

/** Reads a real ERC-20 decimals() value from X Layer mainnet — never assumed. */
export async function getTokenDecimals(tokenAddress: string): Promise<number> {
  const key = tokenAddress.toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const decimals = await client.readContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
  });
  cache.set(key, decimals);
  return decimals;
}

/**
 * Converts an atomic token amount to a human-readable one via a real on-chain
 * decimals() read. `network` (CAIP-2, e.g. "eip155:196") must match the chain
 * this module actually queries — X Layer only, for now. A mismatch fails loudly
 * rather than silently reading decimals() from the wrong chain.
 */
export async function atomicToHuman(amountAtomic: string, tokenAddress: string, network: string): Promise<number> {
  if (!amountAtomic || !tokenAddress) {
    throw new Error(
      `atomicToHuman: a real payment challenge is missing amount ("${amountAtomic}") or token address ("${tokenAddress}") — refusing to record a $0 cost for an unknown real payment`
    );
  }
  if (!network || network !== XLAYER_NETWORK) {
    throw new Error(`atomicToHuman: unsupported or missing network "${network}" — this deployment only resolves decimals on ${XLAYER_NETWORK}`);
  }
  const decimals = await getTokenDecimals(tokenAddress);
  return Number(amountAtomic) / 10 ** decimals;
}
