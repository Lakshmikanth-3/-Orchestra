import { NextResponse } from "next/server";
import { migrate } from "@/lib/ledger";

export async function GET() {
  try {
    await migrate();
    return NextResponse.json({ ok: true, service: "orchestra-asp" });
  } catch (err) {
    // Logged in full server-side; the public, unauthenticated response stays
    // generic so a filesystem-level failure (ENOENT/permissions on
    // ORCHESTRA_DB_PATH) can't leak server file paths to the internet.
    console.error("[health] ledger migration failed:", err);
    return NextResponse.json({ ok: false, error: "ledger_unreachable" }, { status: 503 });
  }
}
