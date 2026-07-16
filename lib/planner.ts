import { PlanSchema, validatePlanBudget, type Plan } from "./schema";
import { groqChat } from "./groq";

const SYSTEM_PROMPT = `You are Orchestra's planner for an agent-to-agent clearinghouse.

Given a user's intent and total USDT budget, decompose it into a dependency-ordered
task DAG.

Hard rules:
- At most 6 tasks.
- Sum of all max_spend_usdt must be <= 60% of the total budget.
- "market_data" is the only capability with a real external cost (paid ASP call);
  give it a realistic non-zero max_spend_usdt. The other capabilities
  (news_scan, risk_flags, synthesize_report) are internal skills — set their
  max_spend_usdt to 0.
- "synthesize_report" should typically depend on the other tasks so it runs last.
- Every depends_on id must reference another task's id in this same plan.

Respond with ONLY the JSON object matching the given schema — no prose, no markdown fences.`;

const PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          capability: { type: "string", enum: ["market_data", "news_scan", "risk_flags", "synthesize_report"] },
          prompt: { type: "string" },
          depends_on: { type: "array", items: { type: "string" } },
          max_spend_usdt: { type: "number" },
        },
        required: ["id", "capability", "prompt", "depends_on", "max_spend_usdt"],
        additionalProperties: false,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
} as const;

export class PlannerError extends Error {}

async function callPlanner(intent: string, budgetUsdt: number): Promise<Plan> {
  const raw = await groqChat({
    system: SYSTEM_PROMPT,
    user: `Intent: ${intent}\nTotal budget USDT: ${budgetUsdt}`,
    maxTokens: 1200,
    jsonSchema: { name: "plan", schema: PLAN_JSON_SCHEMA },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new PlannerError(`Planner returned non-JSON output: ${err instanceof Error ? err.message : String(err)}`);
  }

  const result = PlanSchema.safeParse(parsed);
  if (!result.success) {
    throw new PlannerError(`Planner response failed schema validation: ${result.error.message}`);
  }
  return result.data;
}

export async function generatePlan(intent: string, budgetUsdt: number): Promise<Plan> {
  if (!process.env.GROQ_API_KEY) {
    throw new PlannerError("GROQ_API_KEY is not set — cannot generate a real plan");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await callPlanner(intent, budgetUsdt);
      validatePlanBudget(parsed, budgetUsdt);
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }
  throw new PlannerError(
    `Planner failed to produce a valid plan after retry: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
