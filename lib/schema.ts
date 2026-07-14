import { z } from "zod";

export const CAPABILITIES = [
  "market_data",
  "news_scan",
  "risk_flags",
  "synthesize_report",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const TaskSchema = z.object({
  id: z.string().min(1),
  capability: z.enum(CAPABILITIES),
  prompt: z.string().min(1),
  depends_on: z.array(z.string()).default([]),
  max_spend_usdt: z.number().min(0),
});

export type PlanTask = z.infer<typeof TaskSchema>;

export const PlanSchema = z.object({
  tasks: z.array(TaskSchema).min(1).max(6),
});

export type Plan = z.infer<typeof PlanSchema>;

export function validatePlanBudget(plan: Plan, budgetUsdt: number): void {
  const total = plan.tasks.reduce((sum, t) => sum + t.max_spend_usdt, 0);
  const cap = budgetUsdt * 0.6;
  if (total > cap) {
    throw new Error(
      `Plan exceeds budget cap: sum(max_spend_usdt)=${total} > 60% of ${budgetUsdt} (=${cap})`
    );
  }

  const ids = new Set(plan.tasks.map((t) => t.id));
  for (const task of plan.tasks) {
    for (const dep of task.depends_on) {
      if (!ids.has(dep)) {
        throw new Error(`Task ${task.id} depends_on unknown task id "${dep}"`);
      }
      if (dep === task.id) {
        throw new Error(`Task ${task.id} cannot depend on itself`);
      }
    }
  }
}
