"use client";

import { WalletIcon } from "./icons";

const R = 42;
const CIRC = 2 * Math.PI * R;

function arc(fraction: number): { dash: string; offset: number } {
  const clamped = Math.max(0, Math.min(1, fraction));
  return { dash: `${CIRC} ${CIRC}`, offset: CIRC * (1 - clamped) };
}

export function TreasuryGauge({
  budgetUsdt,
  approvedUsdt,
  spentUsdt,
}: {
  budgetUsdt: number;
  approvedUsdt: number;
  spentUsdt: number;
}) {
  const safe = budgetUsdt > 0 ? budgetUsdt : 1;
  const approvedFrac = approvedUsdt / safe;
  const spentFrac = spentUsdt / safe;
  const approvedArc = arc(approvedFrac);
  const spentArc = arc(spentFrac);

  return (
    <div className="flex items-center gap-4" title={`Spent $${spentUsdt.toFixed(4)} of $${approvedUsdt.toFixed(4)} approved (budget $${budgetUsdt.toFixed(2)})`}>
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--rest)" strokeOpacity={0.18} strokeWidth={7} />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="var(--tuning)"
            strokeOpacity={0.55}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={approvedArc.dash}
            strokeDashoffset={approvedArc.offset}
            className="transition-[stroke-dashoffset] duration-700"
          />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="var(--brass)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={spentArc.dash}
            strokeDashoffset={spentArc.offset}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <WalletIcon className="h-4 w-4 text-rest" />
          <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium text-score">
            ${spentUsdt.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
}
