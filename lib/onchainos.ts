import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class OnchainosError extends Error {}

async function runJson(args: string[], signal?: AbortSignal): Promise<Record<string, unknown>> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("onchainos", args, { timeout: 45_000, signal }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new OnchainosError(`onchainos ${args.join(" ")} failed: ${message}`);
  }
  // onchainos sometimes emits more than one JSON object on stdout -- e.g. an
  // account-auto-creation notice line ahead of the actual result line (seen
  // on a host with no prior `wallet login` session). The real result is
  // always the last line, so parse newline-delimited and take that one
  // rather than JSON.parse-ing the whole (invalid, multi-object) blob.
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      continue;
    }
  }
  throw new OnchainosError(`onchainos ${args.join(" ")} returned non-JSON output: ${stdout}`);
}

export interface WalletStatus {
  loggedIn: boolean;
  currentAccountId: string;
  email: string;
}

export async function walletStatus(): Promise<WalletStatus> {
  const res = await runJson(["wallet", "status"]);
  // Same defensive unwrap as toPaymentResult below: onchainos output has been
  // observed both wrapped (`{ data: {...} }`) and unwrapped for the same
  // command family, so trusting one shape unconditionally risks a raw
  // TypeError instead of a clear OnchainosError.
  const data = (res.data ?? res) as Record<string, unknown>;
  return {
    loggedIn: Boolean(data.loggedIn),
    currentAccountId: String(data.currentAccountId ?? ""),
    email: String(data.email ?? ""),
  };
}

export interface X402PaymentResult {
  authorizationHeader: string;
  headerName: string;
  scheme: string;
  wallet: string;
}

function toPaymentResult(res: Record<string, unknown>): X402PaymentResult {
  const data = (res.data ?? res) as Record<string, unknown>;
  const authorizationHeader = data.authorization_header ?? data.authorizationHeader;
  if (!authorizationHeader) {
    throw new OnchainosError(`onchainos payment response missing authorization_header: ${JSON.stringify(res)}`);
  }
  return {
    authorizationHeader: String(authorizationHeader),
    headerName: String(data.header_name ?? data.headerName ?? "X-PAYMENT"),
    scheme: String(data.scheme ?? ""),
    wallet: String(data.wallet ?? ""),
  };
}

/** Pays an accepts-based 402 (PAYMENT-REQUIRED header v2 / x402Version body v1). */
export async function payX402(rawPayloadBase64: string, selectedIndex?: number, signal?: AbortSignal): Promise<X402PaymentResult> {
  const args = ["payment", "pay", "--payload", rawPayloadBase64];
  if (selectedIndex !== undefined) args.push("--selected-index", String(selectedIndex));
  return toPaymentResult(await runJson(args, signal));
}

/** Pays a WWW-Authenticate: Payment challenge with intent="charge". */
export async function chargeX402(challengeHeaderValue: string, signal?: AbortSignal): Promise<X402PaymentResult> {
  return toPaymentResult(await runJson(["payment", "charge", "--challenge", challengeHeaderValue], signal));
}
