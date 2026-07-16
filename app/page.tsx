"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScoreRail, type RailTask, type NodeState } from "./components/ScoreRail";
import { LedgerTable, type LedgerEventView } from "./components/LedgerTable";
import { ScoreReportView, type ScoreReportData } from "./components/ScoreReportView";
import {
  BellIcon,
  WalletIcon,
  KeyIcon,
  PlayIcon,
  SpinnerIcon,
  AlertIcon,
  PsychologyIcon,
  MinusIcon,
  PlusIcon,
} from "./components/icons";

const OPERATOR_KEY_STORAGE = "orchestra_operator_key";

export default function MissionControl() {
  const [intent, setIntent] = useState("");
  const [budget, setBudget] = useState(1);
  const [operatorKey, setOperatorKey] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(OPERATOR_KEY_STORAGE) ?? ""
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<RailTask[]>([]);
  const [taskState, setTaskState] = useState<Record<string, NodeState>>({});
  const [taskRef, setTaskRef] = useState<Record<string, string>>({});
  const [taskBadges, setTaskBadges] = useState<Record<string, { paid?: boolean; escrow?: boolean }>>({});
  const [ledger, setLedger] = useState<LedgerEventView[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [report, setReport] = useState<ScoreReportData | null>(null);
  const [settledAt, setSettledAt] = useState<string | undefined>(undefined);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => esRef.current?.close(), []);

  useEffect(() => {
    if (!running || startedAt === null) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [running, startedAt]);

  const updateOperatorKey = (value: string) => {
    setOperatorKey(value);
    window.localStorage.setItem(OPERATOR_KEY_STORAGE, value);
  };

  const handleEvent = useCallback((event: LedgerEventView) => {
    setLedger((prev) => [...prev, event]);

    if (event.type === "settled") {
      setRunning(false);
      setSettledAt(event.createdAt);
      return;
    }
    if (event.type === "planned") {
      const planned = (event.data.tasks as RailTask[]) ?? [];
      setTasks(planned);
      setTaskState(Object.fromEntries(planned.map((t) => [t.id, "rest" as NodeState])));
      setTaskRef({});
      setTaskBadges({});
      return;
    }
    if (!event.taskId) return;

    if (event.type === "hired") setTaskState((s) => ({ ...s, [event.taskId!]: "tuning" }));
    if (event.type === "paid") {
      setTaskState((s) => ({ ...s, [event.taskId!]: "paid" }));
      setTaskRef((r) => ({ ...r, [event.taskId!]: String(event.data.ref ?? "") }));
      setTaskBadges((b) => ({
        ...b,
        [event.taskId!]: { paid: true, escrow: Boolean(event.data.escrowLockTx) },
      }));
    }
    if (event.type === "delivered") {
      setTaskState((s) => (s[event.taskId!] === "paid" ? s : { ...s, [event.taskId!]: "done" }));
    }
    if (event.type === "failed") setTaskState((s) => ({ ...s, [event.taskId!]: "failed" }));
  }, []);

  // Once a run settles, fetch the real, itemized Score Report — the live
  // ledger only ever carried totals, never the per-task content/citations.
  useEffect(() => {
    if (!runId || running || ledger.length === 0) return;
    if (!ledger.some((e) => e.type === "settled")) return;
    let cancelled = false;
    fetch(`/api/runs/${runId}/report`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setReport(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [runId, running, ledger]);

  const startNewRun = () => {
    setReport(null);
    setLedger([]);
    setTasks([]);
    setTaskState({});
    setTaskRef({});
    setTaskBadges({});
    setRunId(null);
    setSettledAt(undefined);
    setError(null);
  };

  const run = async () => {
    esRef.current?.close();
    startNewRun();
    setRunning(true);
    setStartedAt(Date.now());
    setElapsedMs(0);

    try {
      const res = await fetch("/api/mc/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-operator-key": operatorKey },
        body: JSON.stringify({ intent, budget_usdt: budget }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Run failed to start");
        setRunning(false);
        return;
      }
      setRunId(body.run_id);

      const es = new EventSource(body.stream);
      esRef.current = es;
      es.onmessage = (msg) => {
        try {
          handleEvent(JSON.parse(msg.data));
        } catch {
          setError("Received a malformed event from the server — see console for the raw payload");
          console.error("Malformed SSE payload:", msg.data);
        }
      };
      es.addEventListener("error", () => {
        es.close();
        setRunning(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed to start");
      setRunning(false);
    }
  };

  const status: "idle" | "running" | "done" | "failed" = running
    ? "running"
    : ledger.some((e) => e.type === "failed")
      ? "failed"
      : ledger.some((e) => e.type === "settled")
        ? "done"
        : "idle";

  const elapsedLabel = useMemo(() => {
    const s = Math.floor(elapsedMs / 1000);
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  }, [elapsedMs]);

  return (
    <div className="bg-pit text-on-surface antialiased min-h-screen flex flex-col relative overflow-x-hidden font-body-md">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 flex justify-between items-center w-full px-6 md:px-10 py-4 bg-pit/80 backdrop-blur-md border-b border-rest/10">
        <div className="flex items-center gap-4">
          <span className="font-headline-lg text-headline-lg font-bold text-brass tracking-tighter">ORCHESTRA</span>
        </div>
        <div className="flex gap-4 text-tuning items-center">
          <span title={running ? "Run in progress" : "Idle"} className={running ? "text-tuning" : "text-rest"}>
            <BellIcon className={`h-5 w-5 ${running ? "animate-tuning-pulse" : ""}`} />
          </span>
          <span title="Orchestra Agentic Wallet" className="text-rest">
            <WalletIcon className="h-5 w-5" />
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col w-full relative z-10">
        <div className="w-full max-w-7xl mx-auto my-6 md:my-10 relative z-20 flex-grow flex flex-col px-4 md:px-0">
          <div className="bg-score text-pit rounded shadow-2xl overflow-hidden flex flex-col flex-grow ring-1 ring-black/10 min-h-[640px]">
            {report ? (
              <>
                <div className="flex justify-end px-8 pt-4">
                  <button
                    onClick={startNewRun}
                    className="font-data-mono-sm text-data-mono-sm text-pit/50 hover:text-brass transition-colors underline"
                  >
                    ← New run
                  </button>
                </div>
                <ScoreReportView report={report} settledAt={settledAt} />
              </>
            ) : (
              <>
                <div className="px-8 py-6 border-b border-black/10 flex justify-between items-end bg-black/5">
                  <div>
                    <h2 className="font-label-caps text-label-caps text-pit/50 mb-2">MISSION CONTROL</h2>
                    <h1 className="font-display-lg text-display-lg text-pit tracking-tight">INTENT CONSOLE</h1>
                  </div>
                </div>

                <div className="flex-grow flex flex-col md:flex-row overflow-hidden relative">
                  {/* Intent Console */}
                  <section className="w-full md:w-[400px] flex-shrink-0 border-b md:border-b-0 md:border-r border-black/10 p-8 flex flex-col z-20 bg-white/50">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-label-caps text-label-caps text-pit tracking-widest uppercase">Agent Directive</h2>
                      <PsychologyIcon className="h-4 w-4 text-pit/40" />
                    </div>
                    <div className="flex-grow flex flex-col gap-6">
                      <div>
                        <label className="block font-data-mono-sm text-data-mono-sm text-pit/50 mb-2" htmlFor="intent-input">
                          Intent Description
                        </label>
                        <textarea
                          id="intent-input"
                          className="w-full h-32 bg-black/5 border border-black/10 rounded-sm p-3 text-pit font-body-md focus:border-brass focus:ring-1 focus:ring-brass outline-none resize-none placeholder-pit/30 transition-colors"
                          placeholder="e.g., Full research brief on ETH — market structure, whale flows, news, risk flags…"
                          value={intent}
                          onChange={(e) => setIntent(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block font-data-mono-sm text-data-mono-sm text-pit/50 mb-2" htmlFor="budget-input">
                          Execution Budget (USDT)
                        </label>
                        <div className="flex items-center bg-black/5 border border-black/10 rounded-sm p-2 focus-within:border-brass focus-within:ring-1 focus-within:ring-brass transition-colors">
                          <button
                            type="button"
                            aria-label="Decrease budget"
                            onClick={() => setBudget((b) => Math.max(0.1, Math.round((b - 0.1) * 100) / 100))}
                            className="text-pit/50 hover:text-brass p-1"
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>
                          <input
                            id="budget-input"
                            className="flex-grow bg-transparent text-center font-data-mono-lg text-data-mono-lg text-pit border-none outline-none focus:ring-0"
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={budget}
                            onChange={(e) => setBudget(Number(e.target.value))}
                          />
                          <button
                            type="button"
                            aria-label="Increase budget"
                            onClick={() => setBudget((b) => Math.round((b + 0.1) * 100) / 100)}
                            className="text-pit/50 hover:text-brass p-1"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 font-data-mono-sm text-data-mono-sm text-pit/50 mb-2" htmlFor="operator-key-input">
                          <KeyIcon className="h-3.5 w-3.5" /> Operator key
                        </label>
                        <input
                          id="operator-key-input"
                          type="password"
                          value={operatorKey}
                          onChange={(e) => updateOperatorKey(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-black/5 border border-black/10 rounded-sm p-2 text-sm text-pit outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-colors"
                        />
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/10">
                        <span className="font-data-mono-sm text-data-mono-sm text-pit/50">Elapsed</span>
                        <span className="font-data-mono-sm text-data-mono-sm text-pit font-medium">
                          {running ? elapsedLabel : "—"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={run}
                      disabled={running || !intent.trim() || !operatorKey.trim()}
                      className="w-full mt-6 bg-brass text-pit font-headline-md text-headline-md font-bold py-4 rounded-sm hover:bg-opacity-90 transition-colors flex justify-center items-center gap-2 disabled:opacity-40"
                    >
                      <span>{running ? "Running…" : "Run Conductor"}</span>
                      {running ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : <PlayIcon className="h-5 w-5" />}
                    </button>

                    {error && (
                      <p role="alert" className="mt-3 flex min-w-0 items-start gap-2 rounded-sm border border-alert/40 bg-alert/10 p-2 text-xs text-alert">
                        <AlertIcon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 break-words">{error}</span>
                      </p>
                    )}
                  </section>

                  {/* Score Rail */}
                  <ScoreRail tasks={tasks} taskState={taskState} taskRef={taskRef} taskBadges={taskBadges} />
                </div>

                <LedgerTable events={ledger} title="Live Ledger Feed" />
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 h-12 flex items-center justify-between px-6 md:px-10 py-2 border-t border-tuning/30 bg-pit shrink-0">
        <div className="font-data-mono-sm text-data-mono-sm text-tuning font-bold">X Layer · eip155:196</div>
        <div className="flex gap-4">
          <span className="font-data-mono-sm text-data-mono-sm text-rest">Status: {status}</span>
        </div>
      </footer>
    </div>
  );
}
