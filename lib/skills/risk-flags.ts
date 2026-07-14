import { anthropicClient, extractTextAndCitations, SKILLS_MODEL, type SkillResult } from "./shared";

export async function runRiskFlags(prompt: string, context: Record<string, unknown>): Promise<SkillResult> {
  const client = anthropicClient();
  const contextBlock = Object.keys(context).length
    ? `\n\nData gathered by earlier tasks in this run:\n${JSON.stringify(context, null, 2)}`
    : "";

  const response = await client.messages.create({
    model: SKILLS_MODEL,
    max_tokens: 2000,
    system:
      "You are Orchestra's internal risk-flags skill. Identify concrete, evidence-backed risk " +
      "signals (contract risk, liquidity/whale concentration, unlocks, negative news, regulatory " +
      "exposure). Search the web for anything not already covered by the supplied context. Never " +
      "state a risk you cannot back with a cited source or the provided data — if you find nothing, say so.",
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages: [{ role: "user", content: `${prompt}${contextBlock}` }],
  });
  return extractTextAndCitations(response.content);
}
