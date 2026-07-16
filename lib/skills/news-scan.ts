import { groqAgenticChat } from "../groq";
import type { SkillResult } from "./shared";

export async function runNewsScan(prompt: string): Promise<SkillResult> {
  return groqAgenticChat({
    system:
      "You are Orchestra's internal news-scan skill. Search the web for current, real news " +
      "relevant to the request. Report only what the search results actually say — never invent " +
      "headlines, dates, or figures. Cite the source for every claim.",
    user: prompt,
    maxTokens: 2000,
  });
}
