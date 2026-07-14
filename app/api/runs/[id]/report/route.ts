import { NextResponse } from "next/server";
import { getRun } from "@/lib/ledger";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const run = await getRun(runId);
  if (!run || !run.report_json) {
    return NextResponse.json({ error: "report_not_ready" }, { status: 404 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/markdown")) {
    return new NextResponse(String(run.report_markdown), { headers: { "Content-Type": "text/markdown" } });
  }
  return NextResponse.json(JSON.parse(String(run.report_json)));
}
