import { createPublicClient, http, erc20Abi } from "viem";

const XLAYER_RPC = "https://rpc.xlayer.tech";

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

export async function atomicToHuman(amountAtomic: string, tokenAddress: string): Promise<number> {
  if (!amountAtomic || !tokenAddress) return 0;
  const decimals = await getTokenDecimals(tokenAddress);
  return Number(amountAtomic) / 10 ** decimals;
}
