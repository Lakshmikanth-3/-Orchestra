import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startRun, PlannerError } from "@/lib/orchestrate-handler";

const OrchestrateRequestSchema = z.object({
  intent: z.string().min(1),
  budget_usdt: z.number().positive(),
});

/**
 * Operator-only entry point for the Mission Control UI itself (PRD FR-7's
 * "manual UI runs may use an operator API key" path). Same-origin only —
 * unlike /api/orchestrate this never asks a browser to hold the operator
 * secret; the real paid gate for external callers lives at /api/orchestrate.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = OrchestrateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await startRun(parsed.data.intent, parsed.data.budget_usdt, "operator_key");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof PlannerError ? err.message : "planner_failed";
    return NextResponse.json(
      { error: "planner_failed", message, refundable_usdt: parsed.data.budget_usdt },
      { status: 422 }
    );
  }
}
