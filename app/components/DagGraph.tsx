"use client";

import { CAPABILITY_ICON, CheckIcon, ChainLinkIcon, CoinIcon, AlertIcon, IntentIcon, ReportIcon } from "./icons";

export interface DagTask {
  id: string;
  capability: string;
  depends_on: string[];
  max_spend_usdt: number;
}

export type NodeState = "rest" | "tuning" | "paid" | "done" | "failed";

const RING: Record<NodeState, string> = {
  rest: "border-rest/40 text-rest shadow-none",
  tuning: "border-tuning text-tuning shadow-[0_0_18px_-2px_var(--tuning)] note-tuning",
  paid: "border-brass text-brass shadow-[0_0_20px_-2px_var(--brass)]",
  done: "border-tuning text-tuning shadow-[0_0_16px_-4px_var(--tuning)]",
  failed: "border-alert text-alert shadow-[0_0_16px_-4px_var(--alert)]",
};

const EDGE_COLOR: Record<NodeState, string> = {
  rest: "var(--rest)",
  tuning: "var(--tuning)",
  paid: "var(--brass)",
  done: "var(--tuning)",
  failed: "var(--alert)",
};

interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  kind: "in" | "out" | "task";
  capability?: string;
}

interface Edge {
  from: string;
  to: string;
}

function layout(tasks: DagTask[]): { nodes: LaidOutNode[]; edges: Edge[]; cols: number } {
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
  for (const t of tasks) levelOf(t.id);

  const maxLevel = tasks.length ? Math.max(...tasks.map((t) => level.get(t.id)!)) : 0;
  const cols = maxLevel + 3; // in-column + task columns + out-column

  const byCol = new Map<number, string[]>();
  for (const t of tasks) {
    const col = level.get(t.id)! + 1;
    byCol.set(col, [...(byCol.get(col) ?? []), t.id]);
  }

  const nodes: LaidOutNode[] = [];
  const colX = (col: number) => ((col + 0.5) / cols) * 100;

  nodes.push({ id: "__in", x: colX(0), y: 50, kind: "in" });
  nodes.push({ id: "__out", x: colX(cols - 1), y: 50, kind: "out" });

  for (const [col, ids] of byCol) {
    ids.forEach((id, i) => {
      const y = ((i + 1) / (ids.length + 1)) * 100;
      const t = byId.get(id)!;
      nodes.push({ id, x: colX(col), y, kind: "task", capability: t.capability });
    });
  }

  const dependedOn = new Set(tasks.flatMap((t) => t.depends_on));
  const edges: Edge[] = [];
  for (const t of tasks) {
    if (t.depends_on.length === 0) edges.push({ from: "__in", to: t.id });
    for (const dep of t.depends_on) edges.push({ from: dep, to: t.id });
    if (!dependedOn.has(t.id)) edges.push({ from: t.id, to: "__out" });
  }
  if (tasks.length === 0) edges.push({ from: "__in", to: "__out" });

  return { nodes, edges, cols };
}

function edgePath(a: LaidOutNode, b: LaidOutNode): string {
  const midX = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
}

export function DagGraph({
  tasks,
  taskState,
  taskBadges,
}: {
  tasks: DagTask[];
  taskState: Record<string, NodeState>;
  taskBadges: Record<string, { paid?: boolean; escrow?: boolean }>;
}) {
  const { nodes, edges } = layout(tasks);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inState: NodeState = tasks.length > 0 ? "done" : "rest";
  const outState: NodeState = tasks.length > 0 && tasks.every((t) => taskState[t.id] === "done" || taskState[t.id] === "paid") ? "paid" : "rest";

  const stateOf = (id: string): NodeState => {
    if (id === "__in") return inState;
    if (id === "__out") return outState;
    return taskState[id] ?? "rest";
  };

  return (
    <div className="relative h-full min-h-[280px] w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {edges.map((e, i) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          const s = stateOf(e.to);
          const active = s !== "rest";
          return (
            <path
              key={i}
              d={edgePath(a, b)}
              fill="none"
              stroke={EDGE_COLOR[s]}
              strokeWidth={active ? 0.45 : 0.3}
              opacity={active ? 0.85 : 0.25}
              strokeDasharray={s === "tuning" ? "1.5 1.5" : undefined}
              className={s === "tuning" ? "edge-flow" : ""}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {nodes.map((n) => {
        const s = stateOf(n.id);
        const badges = n.kind === "task" ? taskBadges[n.id] : undefined;
        const Icon =
          n.kind === "in" ? IntentIcon : n.kind === "out" ? ReportIcon : CAPABILITY_ICON[n.capability ?? ""] ?? ReportIcon;
        const label =
          n.kind === "in" ? "Intent in" : n.kind === "out" ? "Report out" : `${n.capability} · ${n.id}`;

        return (
          <div
            key={n.id}
            title={label}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 bg-pit/90 backdrop-blur transition-all duration-500 sm:h-14 sm:w-14 ${RING[s]}`}
            >
              {s === "failed" ? <AlertIcon className="h-5 w-5" /> : <Icon className="h-5 w-5 sm:h-6 sm:w-6" />}

              {s === "done" && n.kind === "task" && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-tuning text-pit">
                  <CheckIcon className="h-2.5 w-2.5" />
                </span>
              )}
              {badges?.paid && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brass text-pit" title="Paid a real hire">
                  <CoinIcon className="h-2.5 w-2.5" />
                </span>
              )}
              {badges?.escrow && (
                <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-score text-pit" title="Mirrored on-chain">
                  <ChainLinkIcon className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
