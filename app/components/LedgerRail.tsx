"use client";

import { useState } from "react";
import {
  IntentIcon,
  ChipIcon,
  CoinIcon,
  CheckIcon,
  AlertIcon,
  ReportIcon,
  CopyIcon,
  ChainLinkIcon,
} from "./icons";

export interface LedgerEventView {
  id: number;
  type: "planned" | "hired" | "paid" | "delivered" | "failed" | "settled";
  taskId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

const EVENT_ICON: Record<LedgerEventView["type"], (p: { className?: string }) => React.JSX.Element> = {
  planned: IntentIcon,
  hired: ChipIcon,
  paid: CoinIcon,
  delivered: CheckIcon,
  failed: AlertIcon,
  settled: ReportIcon,
};

const EVENT_CLASS: Record<LedgerEventView["type"], string> = {
  planned: "border-rest/50 text-rest",
  hired: "border-tuning/60 text-tuning",
  paid: "border-brass text-brass",
  delivered: "border-tuning text-tuning",
  failed: "border-alert text-alert",
  settled: "border-score text-score",
};

function refOf(data: Record<string, unknown>): string | null {
  const ref = data.ref ?? data.escrowSettleTx ?? data.escrowLockTx;
  return typeof ref === "string" && ref.length > 0 ? ref : null;
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={value}
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex items-center gap-1 rounded border border-rest/30 bg-black/30 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-rest hover:border-tuning hover:text-tuning"
    >
      {copied ? <CheckIcon className="h-2.5 w-2.5" /> : <CopyIcon className="h-2.5 w-2.5" />}
      {value.slice(0, 8)}…
    </button>
  );
}

export function LedgerRail({ events }: { events: LedgerEventView[] }) {
  if (events.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-rest/25 text-rest/50">
        <ReportIcon className="h-5 w-5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
      {events.map((event) => {
        const Icon = EVENT_ICON[event.type];
        const ref = refOf(event.data);
        const hasEscrow = Boolean(event.data.escrowLockTx || event.data.escrowSettleTx);
        return (
          <div key={event.id} className="flex shrink-0 flex-col items-center gap-1.5">
            <div
              title={`${event.type}${event.taskId ? " · " + event.taskId : ""}`}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 bg-pit/80 ${EVENT_CLASS[event.type]}`}
            >
              {hasEscrow ? <ChainLinkIcon className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            {ref && <CopyChip value={ref} />}
          </div>
        );
      })}
    </div>
  );
}
