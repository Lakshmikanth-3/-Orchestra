"use client";

import { CAPABILITY_ICON, AlertIcon, CheckIcon, CoinIcon, ChainLinkIcon } from "./icons";

export interface RailTask {
  id: string;
  capability: string;
  depends_on: string[];
}

export type NodeState = "rest" | "tuning" | "paid" | "done" | "failed";

const NODE_CLASS: Record<NodeState, string> = {
  rest: "border border-dashed border-pit/20 bg-white/50 text-pit/30",
  tuning: "border-2 border-tuning bg-tuning/10 text-tuning shadow-lg animate-tuning-pulse",
  paid: "border-2 border-brass bg-white text-brass shadow-md",
  done: "border-2 border-brass bg-white text-brass shadow-md",
  failed: "border-2 border-alert bg-alert/10 text-alert shadow-md",
};

function orderTasks(tasks: RailTask[]): RailTask[] {
  const level = new Map<string, number>();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  function levelOf(id: string): number {
    if (level.has(id)) return level.get(id)!;
    const t = byId.get(id);
    if (!t || t.depends_on.length === 0) {
      level.set(id, 0);
      return 0;
    }
    const l = 1 + Math.max(...t.depends_on.map((d) => (byId.has(d) ? levelOf(d) : 0)));
    level.set(id, l);
    return l;
  }
  return [...tasks].sort((a, b) => levelOf(a.id) - levelOf(b.id));
}

export function ScoreRail({
  tasks,
  taskState,
  taskRef,
  taskBadges,
}: {
  tasks: RailTask[];
  taskState: Record<string, NodeState>;
  taskRef: Record<string, string>;
  taskBadges: Record<string, { paid?: boolean; escrow?: boolean }>;
}) {
  const ordered = orderTasks(tasks);

  return (
    <section className="relative flex-grow overflow-hidden flex flex-col h-full bg-paper-rail">
      <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-[100px] w-full stave-line opacity-60 pointer-events-none" />
      <div className="flex-grow overflow-x-auto relative py-12 flex items-center min-w-max px-8 h-full">
        <div className="absolute top-1/2 left-0 w-full h-px bg-pit/10 z-0" />
        <div className="relative z-10 flex items-center gap-16 px-8">
          {ordered.length === 0 && (
            <p className="font-data-mono-sm text-pit/40 text-sm">Waiting for a plan…</p>
          )}
          {ordered.map((task) => {
            const state = taskState[task.id] ?? "rest";
            const Icon = CAPABILITY_ICON[task.capability] ?? CheckIcon;
            const ref = taskRef[task.id];
            const badges = taskBadges[task.id];
            return (
              <div key={task.id} className="relative group flex flex-col items-center">
                <div
                  title={`${task.capability} · ${task.id}`}
                  className={`relative w-16 h-16 rounded-sm flex items-center justify-center transition-all duration-500 ${NODE_CLASS[state]}`}
                >
                  {state === "failed" ? <AlertIcon className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                  {badges?.paid && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brass text-pit" title="Paid a real hire">
                      <CoinIcon className="h-3 w-3" />
                    </span>
                  )}
                  {badges?.escrow && (
                    <span className="absolute -bottom-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-pit text-score" title="Mirrored on-chain">
                      <ChainLinkIcon className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="absolute top-20 text-center w-32">
                  <p className="font-label-caps text-label-caps text-pit">{task.capability.replace("_", " ")}</p>
                  <p className="font-data-mono-sm text-data-mono-sm text-pit/50 text-xs mt-1 truncate">{ref ?? task.id}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
