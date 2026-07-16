import { groqAgenticChat } from "../groq";
import type { SkillResult } from "./shared";

export async function runRiskFlags(prompt: string, context: Record<string, unknown>): Promise<SkillResult> {
  const contextBlock = Object.keys(context).length
    ? `\n\nData gathered by earlier tasks in this run:\n${JSON.stringify(context, null, 2)}`
    : "";

  return groqAgenticChat({
    system:
      "You are Orchestra's internal risk-flags skill. Identify concrete, evidence-backed risk " +
      "signals (contract risk, liquidity/whale concentration, unlocks, negative news, regulatory " +
      "exposure). Search the web for anything not already covered by the supplied context. Never " +
      "state a risk you cannot back with a cited source or the provided data — if you find nothing, say so.",
    user: `${prompt}${contextBlock}`,
    maxTokens: 2000,
  });
}
