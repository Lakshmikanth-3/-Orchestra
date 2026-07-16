"use client";

import { CAPABILITY_ICON, AlertIcon, ReceiptIcon, ExternalLinkIcon, ReportIcon } from "./icons";

export interface ReportSection {
  taskId: string;
  capability: string;
  provider: string;
  kind: "external_asp" | "internal";
  status: "delivered" | "failed";
  costUsdt: number;
  paymentRef: string;
  content: unknown;
  citedUrls: string[];
  error?: string;
  escrowLockTx?: string;
  escrowSettleTx?: string;
  escrowError?: string;
}

export interface ScoreReportData {
  runId: string;
  intent: string;
  budgetUsdt: number;
  totalSpentUsdt: number;
  approvedUsdt: number;
  refundableUsdt: number;
  status: "completed" | "failed";
  sections: ReportSection[];
}

function SectionCard({ section }: { section: ReportSection }) {
  const Icon = CAPABILITY_ICON[section.capability] ?? ReportIcon;
  const failed = section.status === "failed";

  return (
    <section
      className={`col-span-1 border rounded-sm p-5 relative ${
        failed ? "bg-alert/10 border-alert/30" : "bg-white/50 border-pit/10"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        {failed ? <AlertIcon className="h-5 w-5 text-alert" /> : <Icon className="h-5 w-5 text-brass" />}
        <h3 className={`font-headline-md text-headline-md capitalize ${failed ? "text-alert" : "text-pit"}`}>
          {section.capability.replace(/_/g, " ")}
        </h3>
        <span className="ml-auto font-data-mono-sm text-data-mono-sm text-pit/40">{section.taskId}</span>
      </div>

      {failed ? (
        <p className="font-body-sm text-body-sm text-pit/70">
          This task failed and produced no data — nothing here is fabricated.
          {section.error ? ` (${section.error})` : ""}
        </p>
      ) : typeof section.content === "string" ? (
        <p className="font-body-sm text-body-sm text-pit/80 whitespace-pre-wrap leading-relaxed">{section.content}</p>
      ) : section.content ? (
        <pre className="font-data-mono-sm text-data-mono-sm text-pit/80 bg-black/5 rounded-sm p-3 overflow-x-auto max-h-64">
          {JSON.stringify(section.content, null, 2)}
        </pre>
      ) : (
        <p className="font-body-sm text-body-sm text-pit/40">No output.</p>
      )}

      {section.citedUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {section.citedUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm border border-pit/15 bg-white px-2 py-1 font-data-mono-sm text-data-mono-sm text-pit/60 hover:text-brass hover:border-brass max-w-[220px] truncate"
            >
              <ExternalLinkIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            </a>
          ))}
        </div>
      )}

      {!failed && section.costUsdt > 0 && (
        <div className="mt-4 pt-3 border-t border-pit/10 flex items-center justify-between font-data-mono-sm text-data-mono-sm">
          <span className="text-pit/50">{section.provider}</span>
          <span className="text-brass font-medium">{section.costUsdt.toFixed(4)} USDT</span>
        </div>
      )}
    </section>
  );
}

export function ScoreReportView({ report, settledAt }: { report: ScoreReportData; settledAt?: string }) {
  return (
    <div className="flex-grow flex flex-col overflow-hidden">
      <div className="px-8 py-6 border-b border-pit/10 flex justify-between items-end bg-black/5">
        <div>
          <h2 className="font-label-caps text-label-caps text-pit/50 mb-2">FINAL DELIVERABLE</h2>
          <h1 className="font-display-lg text-display-lg text-pit tracking-tight">SCORE REPORT</h1>
          <p className="font-body-sm text-body-sm text-pit/60 mt-2 max-w-lg">{report.intent}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-data-mono-sm text-data-mono-sm text-pit/50 mb-1">RUN_ID: {report.runId.slice(0, 8)}…</p>
          {settledAt && <p className="font-data-mono-sm text-data-mono-sm text-pit/50">SETTLED: {settledAt}</p>}
        </div>
      </div>

      <div className="flex-grow p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
        {report.sections.map((section) => (
          <SectionCard key={section.taskId} section={section} />
        ))}
      </div>

      <div className="border-t border-pit/20 bg-paper-ledger p-8">
        <h3 className="font-headline-md text-headline-md text-pit mb-4 flex items-center gap-2">
          <ReceiptIcon className="h-5 w-5" />
          Settlement Ledger
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-data-mono-sm text-data-mono-sm">
            <thead>
              <tr className="border-b-2 border-pit/20 text-pit/50">
                <th className="py-2 px-3 font-medium">Task</th>
                <th className="py-2 px-3 font-medium">Provider</th>
                <th className="py-2 px-3 font-medium text-right">Cost (USDT)</th>
                <th className="py-2 px-3 font-medium text-center">Status</th>
                <th className="py-2 px-3 font-medium">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pit/10 text-pit">
              {report.sections.map((s) => (
                <tr key={s.taskId} className="hover:bg-white/30 transition-colors">
                  <td className="py-3 px-3 capitalize">{s.capability.replace(/_/g, " ")}</td>
                  <td className="py-3 px-3">{s.provider}</td>
                  <td className="py-3 px-3 text-right">{s.costUsdt.toFixed(4)}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-sm text-xs font-bold uppercase ${
                        s.status === "failed"
                          ? "bg-alert/20 text-alert"
                          : s.costUsdt > 0
                            ? "bg-brass/20 text-brass"
                            : "bg-tuning/20 text-tuning"
                      }`}
                    >
                      {s.status === "failed" ? "Failed" : s.costUsdt > 0 ? "Paid" : "Free"}
                    </span>
                  </td>
                  <td className="py-3 px-3 opacity-70 truncate max-w-[160px]">
                    {s.escrowSettleTx ?? (s.paymentRef !== "n/a" && s.paymentRef !== "internal" ? s.paymentRef : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap justify-end items-end gap-8 border-t border-pit/20 pt-4">
          <div className="text-right">
            <p className="font-label-caps text-label-caps text-pit/50 mb-1">TOTAL BUDGET</p>
            <p className="font-data-mono-lg text-data-mono-lg text-pit">{report.budgetUsdt.toFixed(2)} USDT</p>
          </div>
          <div className="text-right">
            <p className="font-label-caps text-label-caps text-pit/50 mb-1">TOTAL SPEND</p>
            <p className="font-data-mono-lg text-data-mono-lg text-brass font-bold">{report.totalSpentUsdt.toFixed(4)} USDT</p>
          </div>
          <div className="text-right">
            <p className="font-label-caps text-label-caps text-pit/50 mb-1">REFUNDABLE</p>
            <p className="font-data-mono-lg text-data-mono-lg text-tuning">{report.refundableUsdt.toFixed(4)} USDT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
