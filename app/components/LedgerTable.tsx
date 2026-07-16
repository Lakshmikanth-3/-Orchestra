"use client";

export interface LedgerEventView {
  id: number;
  type: "planned" | "hired" | "paid" | "delivered" | "failed" | "settled";
  taskId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

const EVENT_LABEL: Record<LedgerEventView["type"], string> = {
  planned: "PLAN_RECEIVED",
  hired: "AGENT_HIRED",
  paid: "PAYMENT_SETTLED",
  delivered: "TASK_DELIVERED",
  failed: "TASK_FAILED",
  settled: "RUN_SETTLED",
};

const EVENT_CLASS: Record<LedgerEventView["type"], string> = {
  planned: "text-pit/50",
  hired: "text-tuning font-bold",
  paid: "text-brass font-bold",
  delivered: "text-pit",
  failed: "text-alert font-bold",
  settled: "text-pit font-bold",
};

function detailFor(event: LedgerEventView): string {
  const d = event.data;
  switch (event.type) {
    case "planned":
      return `Plan received: ${(d.tasks as unknown[] | undefined)?.length ?? 0} task(s)`;
    case "hired":
      return `${d.provider ?? "provider"} assigned to ${event.taskId}`;
    case "paid":
      return `${d.usdt ?? 0} USDT · ref ${String(d.ref ?? "").slice(0, 12)}${d.escrowLockTx ? " · mirrored on-chain" : ""}`;
    case "delivered":
      return `${event.taskId} delivered by ${d.provider ?? "provider"}`;
    case "failed":
      return String(d.error ?? d.reason ?? "task failed");
    case "settled":
      return `Spent ${d.totalSpentUsdt ?? 0} of ${d.approvedUsdt ?? 0} USDT · refundable ${d.refundableUsdt ?? 0} USDT`;
    default:
      return "";
  }
}

export function LedgerTable({ events, title }: { events: LedgerEventView[]; title: string }) {
  return (
    <section className="h-[30vh] min-h-[220px] border-t border-pit/20 bg-paper-ledger flex flex-col shrink-0">
      <div className="flex items-center justify-between px-8 py-4 border-b border-pit/10">
        <h3 className="font-headline-md text-headline-md text-pit">{title}</h3>
        <span className="font-data-mono-sm text-data-mono-sm text-pit/50">{events.length} EVENT{events.length === 1 ? "" : "S"}</span>
      </div>
      <div className="flex-grow overflow-y-auto p-8 pt-4">
        {events.length === 0 ? (
          <p className="font-data-mono-sm text-data-mono-sm text-pit/40">No events yet.</p>
        ) : (
          <table className="w-full text-left border-collapse font-data-mono-sm text-data-mono-sm">
            <tbody className="divide-y divide-pit/5 text-pit">
              {[...events].reverse().map((event) => (
                <tr key={event.id} className="hover:bg-white/30 transition-colors">
                  <td className="py-3 px-3 w-32 text-pit/50 align-top">{event.createdAt.split(" ")[1] ?? event.createdAt}</td>
                  <td className={`py-3 px-3 align-top whitespace-nowrap ${EVENT_CLASS[event.type]}`}>{EVENT_LABEL[event.type]}</td>
                  <td className="py-3 px-3 opacity-80 align-top">{detailFor(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
