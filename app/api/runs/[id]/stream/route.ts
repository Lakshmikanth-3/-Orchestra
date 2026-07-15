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
  const parsedAfterId = lastEventId ? Number(lastEventId) : 0;
  // A malformed Last-Event-ID (non-numeric, negative) must not silently
  // resolve to NaN — any comparison against NaN is false, which would make
  // getEvents return zero backlog rows instead of replaying full history.
  const afterId = Number.isFinite(parsedAfterId) && parsedAfterId >= 0 ? parsedAfterId : 0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      let maxSeenId = afterId;
      const emit = (event: LedgerEvent) => {
        if (closed) return;
        if (event.id <= maxSeenId) return; // already delivered (backlog vs. live overlap)
        maxSeenId = event.id;
        controller.enqueue(encoder.encode(sseLine(event)));
        if (event.type === "settled") {
          unsubscribe();
          close();
        }
      };

      // Subscribe BEFORE reading the backlog. If we read the backlog first,
      // any event published in the gap between that read and subscribing
      // (e.g. a very short run's "settled" event) would land in neither and
      // be lost forever, leaving the connection open with no terminal event
      // ever coming. Events arriving during the backlog read are buffered
      // here and replayed after, deduped against the backlog by id via emit().
      let buffering = true;
      const buffered: LedgerEvent[] = [];
      const unsubscribe = subscribe(runId, (event) => {
        if (buffering) buffered.push(event);
        else emit(event);
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        close();
      });

      const backlog = await getEvents(runId, afterId);
      for (const event of backlog) emit(event);
      buffering = false;
      for (const event of buffered) emit(event);
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
