"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPERATOR_KEY_STORAGE = "orchestra_operator_key";

interface PlanTaskView {
  id: string;
  capability: string;
  prompt: string;
  depends_on: string[];
  max_spend_usdt: number;
}

type TaskState = "rest" | "tuning" | "paid" | "done" | "failed";

interface LedgerEventView {
  id: number;
  type: "planned" | "hired" | "paid" | "delivered" | "failed" | "settled";
  taskId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

const STATE_CLASS: Record<TaskState, string> = {
  rest: "border-rest/50 text-rest",
  tuning: "border-tuning text-tuning note-tuning",
  paid: "border-brass bg-brass/10 text-brass",
  done: "border-tuning bg-tuning/10 text-tuning",
  failed: "border-alert bg-alert/10 text-alert",
};

export default function MissionControl() {
  const [intent, setIntent] = useState("");
  const [budget, setBudget] = useState(1);
  const [operatorKey, setOperatorKey] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PlanTaskView[]>([]);
  const [taskState, setTaskState] = useState<Record<string, TaskState>>({});
  const [taskRef, setTaskRef] = useState<Record<string, string>>({});
  const [ledger, setLedger] = useState<LedgerEventView[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(OPERATOR_KEY_STORAGE);
    if (saved) setOperatorKey(saved);
  }, []);

  const updateOperatorKey = (value: string) => {
    setOperatorKey(value);
    window.localStorage.setItem(OPERATOR_KEY_STORAGE, value);
  };

  const handleEvent = useCallback((event: LedgerEventView) => {
    setLedger((prev) => [...prev, event]);

    if (event.type === "planned") {
      const planned = (event.data.tasks as PlanTaskView[]) ?? [];
      setTasks(planned);
      setTaskState(Object.fromEntries(planned.map((t) => [t.id, "rest" as TaskState])));
      return;
    }
    if (!event.taskId) return;

    if (event.type === "hired") setTaskState((s) => ({ ...s, [event.taskId!]: "tuning" }));
    if (event.type === "paid") {
      setTaskState((s) => ({ ...s, [event.taskId!]: "paid" }));
      setTaskRef((r) => ({ ...r, [event.taskId!]: String(event.data.ref ?? "") }));
    }
    if (event.type === "delivered") {
      setTaskState((s) => (s[event.taskId!] === "paid" ? s : { ...s, [event.taskId!]: "done" }));
    }
    if (event.type === "failed") setTaskState((s) => ({ ...s, [event.taskId!]: "failed" }));
  }, []);

  const run = async () => {
    setError(null);
    setRunning(true);
    setTasks([]);
    setTaskState({});
    setTaskRef({});
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
      es.onmessage = (msg) => handleEvent(JSON.parse(msg.data));
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
    <main className="flex flex-1 flex-col gap-6 p-6 md:flex-row">
      <section className="w-full shrink-0 space-y-4 md:w-80">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-score">
          🎼 Orchestra
        </h1>
        <p className="text-sm text-rest">One intent in. An agent economy out.</p>

        <textarea
          className="h-32 w-full resize-none rounded border border-rest/40 bg-transparent p-3 text-sm text-score outline-none focus:border-tuning"
          placeholder="Hand me a goal and a budget."
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        />

        <div className="flex items-center gap-2">
          <label className="text-sm text-rest">Budget (USDT)</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-24 rounded border border-rest/40 bg-transparent p-2 text-sm text-score outline-none focus:border-tuning"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-rest">Operator key</label>
          <input
            type="password"
            value={operatorKey}
            onChange={(e) => updateOperatorKey(e.target.value)}
            placeholder="ORCHESTRA_OPERATOR_KEY"
            className="w-full rounded border border-rest/40 bg-transparent p-2 text-sm text-score outline-none focus:border-tuning"
          />
          <p className="text-xs text-rest">Held in this browser only — never shipped in the app bundle.</p>
        </div>

        <button
          onClick={run}
          disabled={running || !intent.trim() || !operatorKey.trim()}
          className="w-full rounded bg-brass py-2 font-[family-name:var(--font-display)] font-bold text-pit disabled:opacity-40"
        >
          {running ? "Running…" : "Run"}
        </button>

        {error && <p className="text-sm text-alert">{error}</p>}
      </section>

      <section className="flex-1 space-y-6">
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm uppercase tracking-wide text-rest">
            Score Rail
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {tasks.length === 0 && <p className="text-sm text-rest">Waiting for a plan…</p>}
            {tasks.map((task) => {
              const state = taskState[task.id] ?? "rest";
              const ref = taskRef[task.id];
              return (
                <div
                  key={task.id}
                  className={`min-w-48 shrink-0 rounded border-2 p-3 transition-colors ${STATE_CLASS[state]}`}
                >
                  <div className="font-[family-name:var(--font-display)] text-sm font-bold">
                    {task.capability}
                  </div>
                  <div className="mt-1 text-xs opacity-80">{task.id}</div>
                  {ref && (
                    <div className="mt-2 truncate font-[family-name:var(--font-mono)] text-[10px]">
                      {ref}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm uppercase tracking-wide text-rest">
            Settlement Ledger
          </h2>
          <div className="h-64 overflow-y-auto rounded border border-rest/20 bg-black/20 p-3 font-[family-name:var(--font-mono)] text-xs">
            {ledger.length === 0 && <p className="text-rest">No events yet.</p>}
            {ledger.map((event) => (
              <div key={event.id} className="border-b border-rest/10 py-1">
                <span className="text-tuning">{event.type}</span>
                {event.taskId && <span className="text-rest"> · {event.taskId}</span>}
                <span className="text-rest"> · {event.createdAt}</span>
                <pre className="whitespace-pre-wrap text-[10px] text-score/70">
                  {JSON.stringify(event.data)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
