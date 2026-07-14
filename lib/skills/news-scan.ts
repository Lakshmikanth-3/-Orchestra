import { anthropicClient, extractTextAndCitations, SKILLS_MODEL, type SkillResult } from "./shared";

export async function runNewsScan(prompt: string): Promise<SkillResult> {
  const client = anthropicClient();
  const response = await client.messages.create({
    model: SKILLS_MODEL,
    max_tokens: 2000,
    system:
      "You are Orchestra's internal news-scan skill. Search the web for current, real news " +
      "relevant to the request. Report only what the search results actually say — never invent " +
      "headlines, dates, or figures. Cite the source for every claim.",
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages: [{ role: "user", content: prompt }],
  });
  return extractTextAndCitations(response.content);
}
