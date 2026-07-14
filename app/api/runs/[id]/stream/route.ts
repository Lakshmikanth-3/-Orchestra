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
      const backlog = await getEvents(runId, afterId);
      for (const event of backlog) {
        controller.enqueue(encoder.encode(sseLine(event)));
      }

      const unsubscribe = subscribe(runId, (event) => {
        controller.enqueue(encoder.encode(sseLine(event)));
        if (event.type === "settled") {
          controller.close();
          unsubscribe();
        }
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
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
