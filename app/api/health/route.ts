import { NextResponse } from "next/server";
import { migrate } from "@/lib/ledger";

export async function GET() {
  try {
    await migrate();
    return NextResponse.json({ ok: true, service: "orchestra-asp" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
