import { NextRequest, NextResponse } from "next/server";
import { startRun, PlannerError, OrchestrateRequestSchema } from "@/lib/orchestrate-handler";

/**
 * Operator entry point for the Mission Control UI (PRD FR-7's "manual UI runs
 * may use an operator API key" path). Next.js does not restrict API routes by
 * origin — CORS is a browser-response concept, not a request gate, so a raw
 * curl can reach this route exactly as easily as the UI can. The real gate is
 * this header check: the operator types ORCHESTRA_OPERATOR_KEY into the UI at
 * runtime (held only in browser memory/localStorage), so the secret is never
 * baked into the JS bundle the way a NEXT_PUBLIC_ env var would be.
 */
export async function POST(req: NextRequest) {
  const operatorKey = req.headers.get("x-operator-key");
  const expected = process.env.ORCHESTRA_OPERATOR_KEY;
  if (!expected || !operatorKey || operatorKey !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
