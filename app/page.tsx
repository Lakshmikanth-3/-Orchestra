"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DagGraph, type DagTask, type NodeState } from "./components/DagGraph";
import { TreasuryGauge } from "./components/TreasuryGauge";
import { LedgerRail, type LedgerEventView } from "./components/LedgerRail";
import { IntentIcon, KeyIcon, WalletIcon, PlayIcon, SpinnerIcon, AlertIcon } from "./components/icons";

const OPERATOR_KEY_STORAGE = "orchestra_operator_key";

const STATUS_DOT: Record<"idle" | "running" | "done" | "failed", string> = {
  idle: "bg-rest",
  running: "bg-tuning note-tuning",
  done: "bg-brass",
  failed: "bg-alert",
};

export default function MissionControl() {
  const [intent, setIntent] = useState("");
  const [budget, setBudget] = useState(1);
  const [operatorKey, setOperatorKey] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(OPERATOR_KEY_STORAGE) ?? ""
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DagTask[]>([]);
  const [taskState, setTaskState] = useState<Record<string, NodeState>>({});
  const [taskBadges, setTaskBadges] = useState<Record<string, { paid?: boolean; escrow?: boolean }>>({});
  const [spentUsdt, setSpentUsdt] = useState(0);
  const [ledger, setLedger] = useState<LedgerEventView[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => esRef.current?.close(), []);

  const updateOperatorKey = (value: string) => {
    setOperatorKey(value);
    window.localStorage.setItem(OPERATOR_KEY_STORAGE, value);
  };

  const approvedUsdt = useMemo(() => tasks.reduce((sum, t) => sum + t.max_spend_usdt, 0), [tasks]);

  const status: "idle" | "running" | "done" | "failed" = running
    ? "running"
    : ledger.some((e) => e.type === "failed")
      ? "failed"
      : ledger.some((e) => e.type === "settled")
        ? "done"
        : "idle";

  const handleEvent = useCallback((event: LedgerEventView) => {
    setLedger((prev) => [...prev, event]);

    if (event.type === "settled") {
      setRunning(false);
      return;
    }
    if (event.type === "planned") {
      const planned = (event.data.tasks as DagTask[]) ?? [];
      setTasks(planned);
      setTaskState(Object.fromEntries(planned.map((t) => [t.id, "rest" as NodeState])));
      setTaskBadges({});
      setSpentUsdt(0);
      return;
    }
    if (!event.taskId) return;

    if (event.type === "hired") setTaskState((s) => ({ ...s, [event.taskId!]: "tuning" }));
    if (event.type === "paid") {
      setTaskState((s) => ({ ...s, [event.taskId!]: "paid" }));
      const usdt = Number(event.data.usdt ?? 0);
      if (Number.isFinite(usdt)) setSpentUsdt((s) => s + usdt);
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

  const run = async () => {
    esRef.current?.close();
    setError(null);
    setRunning(true);
    setTasks([]);
    setTaskState({});
    setTaskBadges({});
    setSpentUsdt(0);
    setLedger([]);

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

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <header className="glass-card flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>🎼</span>
          <span className="font-[family-name:var(--font-display)] text-lg font-bold text-score">Orchestra</span>
        </div>
        <div className="flex items-center gap-2" title={`Status: ${status}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
          <span className="sr-only">{status}</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <section className="glass-card flex w-full shrink-0 flex-col gap-4 p-5 lg:w-72">
          <label className="flex flex-col gap-2">
            <span className="sr-only">Intent</span>
            <span className="flex items-center gap-2 text-rest">
              <IntentIcon className="h-4 w-4" />
            </span>
            <textarea
              className="h-28 w-full resize-none rounded-lg border border-rest/30 bg-black/20 p-3 text-sm text-score outline-none focus-visible:border-tuning focus-visible:ring-2 focus-visible:ring-tuning/40"
              placeholder="Hand me a goal and a budget…"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2">
            <WalletIcon className="h-4 w-4 shrink-0 text-rest" />
            <span className="sr-only">Budget in USDT</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full rounded-lg border border-rest/30 bg-black/20 p-2 text-sm text-score outline-none focus-visible:border-tuning focus-visible:ring-2 focus-visible:ring-tuning/40"
            />
          </label>

          <label className="flex items-center gap-2">
            <KeyIcon className="h-4 w-4 shrink-0 text-rest" />
            <span className="sr-only">Operator key — held in this browser only</span>
            <input
              type="password"
              value={operatorKey}
              onChange={(e) => updateOperatorKey(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-rest/30 bg-black/20 p-2 text-sm text-score outline-none focus-visible:border-tuning focus-visible:ring-2 focus-visible:ring-tuning/40"
            />
          </label>

          <button
            onClick={run}
            disabled={running || !intent.trim() || !operatorKey.trim()}
            aria-label="Run"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brass py-2.5 font-[family-name:var(--font-display)] font-bold text-pit transition-opacity disabled:opacity-40"
          >
            {running ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
          </button>

          {error && (
            <p role="alert" className="flex min-w-0 items-start gap-2 rounded-lg border border-alert/40 bg-alert/10 p-2 text-xs text-alert">
              <AlertIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </p>
          )}

          <div className="mt-auto flex justify-center border-t border-rest/15 pt-4">
            <TreasuryGauge budgetUsdt={budget} approvedUsdt={approvedUsdt} spentUsdt={spentUsdt} />
          </div>
        </section>

        <section className="glass-card flex-1 p-3 lg:p-5">
          <DagGraph tasks={tasks} taskState={taskState} taskBadges={taskBadges} />
        </section>
      </div>

      <section className="glass-card p-4">
        <LedgerRail events={ledger} />
      </section>
    </main>
  );
}
