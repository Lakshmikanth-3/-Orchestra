import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@okxweb3/x402-next";
import { z } from "zod";
import { getResourceServer, facilitatorCredsConfigured, XLAYER_NETWORK, RUN_PRICE_USD } from "@/lib/x402-server";
import { startRun, PlannerError } from "@/lib/orchestrate-handler";

const OrchestrateRequestSchema = z.object({
  intent: z.string().min(1),
  budget_usdt: z.number().positive(),
});

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

/** Real, paid A2MCP entry point — every machine-to-machine caller (OKX.AI listing) goes through here. */
export async function POST(req: NextRequest) {
  if (!facilitatorCredsConfigured()) {
    return NextResponse.json(
      {
        error: "payment_gate_unconfigured",
        message:
          "Inbound x402 payment gate requires OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE " +
          "(apply at https://web3.okx.com/onchainos/dev-portal).",
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
    },
    getResourceServer()
  );
  return wrapped(req);
}
