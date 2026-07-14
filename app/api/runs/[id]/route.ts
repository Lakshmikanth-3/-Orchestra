import { NextResponse } from "next/server";
import { getRun, getEvents } from "@/lib/ledger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const run = await getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const events = await getEvents(runId);
  return NextResponse.json({ run, events });
}
