import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PlanSchema, validatePlanBudget, type Plan } from "./schema";

const PLANNER_MODEL = "claude-sonnet-5";

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
- Every depends_on id must reference another task's id in this same plan.`;

export class PlannerError extends Error {}

async function callPlanner(client: Anthropic, intent: string, budgetUsdt: number): Promise<Plan> {
  const response = await client.messages.parse({
    model: PLANNER_MODEL,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(PlanSchema) },
    messages: [
      {
        role: "user",
        content: `Intent: ${intent}\nTotal budget USDT: ${budgetUsdt}`,
      },
    ],
  });
  if (!response.parsed_output) {
    throw new PlannerError(`Planner response failed schema validation (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output;
}

export async function generatePlan(intent: string, budgetUsdt: number): Promise<Plan> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new PlannerError("ANTHROPIC_API_KEY is not set — cannot generate a real plan");
  }
  const client = new Anthropic();

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await callPlanner(client, intent, budgetUsdt);
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
