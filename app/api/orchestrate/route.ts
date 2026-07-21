import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@okxweb3/x402-next";
import { getResourceServer, facilitatorCredsConfigured, orchestrateResourceUrl, XLAYER_NETWORK, RUN_PRICE_USD } from "@/lib/x402-server";
import { startRun, PlannerError, OrchestrateRequestSchema } from "@/lib/orchestrate-handler";

async function handlePaidOrchestrate(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  const parsed = OrchestrateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await startRun(parsed.data.intent, parsed.data.budget_usdt, "x402");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof PlannerError ? err.message : "planner_failed";
    return NextResponse.json(
      { error: "planner_failed", message, refundable_usdt: parsed.data.budget_usdt },
      { status: 422 }
    );
  }
}

async function gatedOrchestrate(req: NextRequest): Promise<NextResponse> {
  if (!facilitatorCredsConfigured()) {
    return NextResponse.json(
      {
        error: "payment_gate_unconfigured",
        message:
          "Inbound x402 payment gate requires OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE " +
          "(apply at https://web3.okx.com/onchainos/dev-portal) and ORCHESTRA_AGENTIC_WALLET " +
          "(the payment recipient address).",
      },
      { status: 503 }
    );
  }

  const wrapped = withX402(
    handlePaidOrchestrate,
    {
      accepts: {
        scheme: "exact",
        price: RUN_PRICE_USD,
        network: XLAYER_NETWORK,
        payTo: process.env.ORCHESTRA_AGENTIC_WALLET!,
      },
      description: "Orchestra run: intent -> hired agents -> settled report",
      ...(orchestrateResourceUrl() ? { resource: orchestrateResourceUrl() } : {}),
    },
    getResourceServer()
  );
  return wrapped(req);
}

/** Real, paid A2MCP entry point — every machine-to-machine caller (OKX.AI listing) goes through here. */
export async function POST(req: NextRequest) {
  return gatedOrchestrate(req);
}

/**
 * Some x402 clients/validators probe with GET before the real paid POST, to
 * check whether a resource is x402-gated at all -- Next.js returns a plain
 * 405 for any method a route doesn't export, which reads as "not a valid
 * x402 service" rather than "payment required". Gating GET the same way
 * means the 402 challenge is visible regardless of which method a caller
 * probes with first.
 */
export async function GET(req: NextRequest) {
  return gatedOrchestrate(req);
}
