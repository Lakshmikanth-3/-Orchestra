import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

export type RunStatus = "planning" | "running" | "completed" | "failed";
export type LedgerEventType = "planned" | "hired" | "paid" | "delivered" | "failed" | "settled";

export interface LedgerEvent {
  id: number;
  runId: string;
  type: LedgerEventType;
  taskId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

let client: Client | null = null;

/** Closes the underlying SQLite connection. For test cleanup only — the app itself keeps one open for its lifetime. */
export function closeDb(): void {
  client?.close();
  client = null;
}

function db(): Client {
  if (client) return client;
  const dbPath = process.env.ORCHESTRA_DB_PATH ?? "./data/orchestra.db";
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  client = createClient({ url: `file:${dbPath}` });
  return client;
}

export async function migrate(): Promise<void> {
  const c = db();
  await c.execute(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      intent TEXT NOT NULL,
      budget_usdt REAL NOT NULL,
      status TEXT NOT NULL,
      paid_via TEXT,
      report_json TEXT,
      report_markdown TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      task_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function createRun(id: string, intent: string, budgetUsdt: number, paidVia: string): Promise<void> {
  await migrate();
  await db().execute({
    sql: "INSERT INTO runs (id, intent, budget_usdt, status, paid_via) VALUES (?, ?, ?, 'planning', ?)",
    args: [id, intent, budgetUsdt, paidVia],
  });
}

export async function setRunStatus(runId: string, status: RunStatus): Promise<void> {
  await db().execute({ sql: "UPDATE runs SET status = ? WHERE id = ?", args: [status, runId] });
}

export async function getRun(runId: string): Promise<Record<string, unknown> | null> {
  const res = await db().execute({ sql: "SELECT * FROM runs WHERE id = ?", args: [runId] });
  return (res.rows[0] as unknown as Record<string, unknown>) ?? null;
}

export async function saveReport(runId: string, reportJson: unknown, reportMarkdown: string): Promise<void> {
  await db().execute({
    sql: "UPDATE runs SET report_json = ?, report_markdown = ? WHERE id = ?",
    args: [JSON.stringify(reportJson), reportMarkdown, runId],
  });
}

export async function appendEvent(
  runId: string,
  type: LedgerEventType,
  taskId: string | null,
  data: Record<string, unknown>
): Promise<LedgerEvent> {
  const res = await db().execute({
    sql: "INSERT INTO events (run_id, type, task_id, data) VALUES (?, ?, ?, ?) RETURNING id, created_at",
    args: [runId, type, taskId, JSON.stringify(data)],
  });
  const row = res.rows[0] as unknown as { id: number; created_at: string };
  return { id: row.id, runId, type, taskId, data, createdAt: row.created_at };
}

export async function getEvents(runId: string, afterId = 0): Promise<LedgerEvent[]> {
  const res = await db().execute({
    sql: "SELECT * FROM events WHERE run_id = ? AND id > ? ORDER BY id ASC",
    args: [runId, afterId],
  });
  return res.rows.map((r) => {
    const row = r as unknown as { id: number; run_id: string; type: LedgerEventType; task_id: string | null; data: string; created_at: string };
    return {
      id: row.id,
      runId: row.run_id,
      type: row.type,
      taskId: row.task_id,
      data: JSON.parse(row.data),
      createdAt: row.created_at,
    };
  });
}
