import { NextRequest } from "next/server";
import { getEvents, type LedgerEvent } from "@/lib/ledger";
import { subscribe } from "@/lib/bus";

export const dynamic = "force-dynamic";

function sseLine(event: LedgerEvent): string {
  return `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const lastEventId = req.headers.get("last-event-id");
  const afterId = lastEventId ? Number(lastEventId) : 0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const backlog = await getEvents(runId, afterId);
      for (const event of backlog) {
        controller.enqueue(encoder.encode(sseLine(event)));
      }

      // The run may have already settled before this client connected (or
      // reconnected via Last-Event-ID) — don't subscribe to future events
      // that will never come.
      if (backlog.some((event) => event.type === "settled")) {
        close();
        return;
      }

      const unsubscribe = subscribe(runId, (event) => {
        controller.enqueue(encoder.encode(sseLine(event)));
        if (event.type === "settled") {
          unsubscribe();
          close();
        }
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
