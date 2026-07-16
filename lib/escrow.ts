import { createWalletClient, createPublicClient, http, keccak256, toBytes, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const XLAYER_MAINNET = {
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
} as const;

const XLAYER_TESTNET = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech/terigon"] } },
} as const;

/**
 * Mainnet by default (production behavior unchanged). Set
 * ORCHESTRA_ESCROW_NETWORK=testnet to point every call in this module at
 * X Layer testnet instead -- for exercising this real integration code
 * itself against a real (worthless) chain, not just the deployed contract
 * via raw cast calls.
 */
function escrowNetwork(): "mainnet" | "testnet" {
  return process.env.ORCHESTRA_ESCROW_NETWORK === "testnet" ? "testnet" : "mainnet";
}

function envVarNames(): { addr: string; key: string } {
  return escrowNetwork() === "testnet"
    ? { addr: "ORCHESTRA_ESCROW_ADDRESS_TESTNET", key: "DEPLOYER_PRIVATE_KEY_TESTNET" }
    : { addr: "ORCHESTRA_ESCROW_ADDRESS", key: "DEPLOYER_PRIVATE_KEY" };
}

const ESCROW_ABI = parseAbi([
  "function lock(bytes32 id, address client, address agent) external payable",
  "function settle(bytes32 id) external",
  "function refund(bytes32 id) external",
]);

// Hard-capped per-task mirror value (PRD §7.5: "~0.1 USD/task", "hard-capped in
// config"). Denominated in native OKB wei since OrchestraEscrow takes msg.value,
// not an ERC-20 — this default is a small, documented config constant, not a
// claim about OKB's real-time USD price. Override via ESCROW_MIRROR_VALUE_WEI,
// tuned against a real OKB/USD rate, to approximate the ~0.1 USD figure.
const DEFAULT_MIRROR_VALUE_WEI = BigInt("100000000000000"); // 0.0001 OKB

function mirrorValueWei(): bigint {
  const override = process.env.ESCROW_MIRROR_VALUE_WEI;
  return override ? BigInt(override) : DEFAULT_MIRROR_VALUE_WEI;
}

export class EscrowError extends Error {}

export interface EscrowMirrorResult {
  txHash: string;
}

/** True only when a deployed escrow contract and a signing key are both configured — the on-chain mirror is optional (Vision Layer), never a fallback for the real x402 payment, which already happened regardless. */
export function isEscrowConfigured(): boolean {
  const { addr, key } = envVarNames();
  return Boolean(process.env[addr] && process.env[key]);
}

/** Exported for testing: plan task ids (e.g. "t1") only guarantee uniqueness within one run, not on-chain across runs, so every escrow key is scoped to runId. */
export function taskKey(runId: string, taskId: string): `0x${string}` {
  return keccak256(toBytes(`${runId}:${taskId}`));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new EscrowError(`${name} is not set — escrow mirroring is not configured`);
  return value;
}

function clients() {
  const { addr, key } = envVarNames();
  const chain = escrowNetwork() === "testnet" ? XLAYER_TESTNET : XLAYER_MAINNET;
  const account = privateKeyToAccount(requireEnv(key) as `0x${string}`);
  const escrowAddress = requireEnv(addr) as `0x${string}`;
  const transport = http(chain.rpcUrls.default.http[0]);
  const wallet = createWalletClient({ account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });
  return { account, escrowAddress, wallet, publicClient };
}

/**
 * Locks a real, hard-capped native-OKB mirror value on X Layer mainnet for
 * one DAG task, keyed by keccak256(runId:taskId) so task ids that repeat
 * across runs (the planner only guarantees per-run uniqueness) never collide
 * on-chain. Returns the real transaction hash once it's mined.
 */
export async function lockTaskEscrow(
  runId: string,
  taskId: string,
  agentAddress: string,
  valueWei: bigint = mirrorValueWei()
): Promise<EscrowMirrorResult> {
  const { account, escrowAddress, wallet, publicClient } = clients();
  const hash = await wallet.writeContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "lock",
    args: [taskKey(runId, taskId), account.address, agentAddress as `0x${string}`],
    value: valueWei,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash };
}

export async function settleTaskEscrow(runId: string, taskId: string): Promise<EscrowMirrorResult> {
  const { escrowAddress, wallet, publicClient } = clients();
  const hash = await wallet.writeContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "settle",
    args: [taskKey(runId, taskId)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash };
}

/**
 * Not called automatically by the executor. If lockTaskEscrow succeeds but
 * settleTaskEscrow then fails (e.g. a transient RPC error), the contract is
 * left with that task Locked and its mirror value genuinely held on-chain —
 * an operator resolves that manually with either a retried settle or this,
 * rather than the service silently auto-refunding a lock that might just need
 * a retry.
 */
export async function refundTaskEscrow(runId: string, taskId: string): Promise<EscrowMirrorResult> {
  const { escrowAddress, wallet, publicClient } = clients();
  const hash = await wallet.writeContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "refund",
    args: [taskKey(runId, taskId)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash };
}
