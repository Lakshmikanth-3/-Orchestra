import Anthropic from "@anthropic-ai/sdk";

export const SKILLS_MODEL = "claude-sonnet-5";

export interface SkillResult {
  text: string;
  citedUrls: string[];
}

let sharedClient: Anthropic | null = null;

export function anthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — cannot run internal skill");
  }
  if (!sharedClient) sharedClient = new Anthropic();
  return sharedClient;
}

export function extractTextAndCitations(content: Anthropic.ContentBlock[]): SkillResult {
  const texts: string[] = [];
  const urls = new Set<string>();

  for (const block of content) {
    if (block.type === "text") {
      texts.push(block.text);
      for (const citation of block.citations ?? []) {
        if (citation.type === "web_search_result_location" && citation.url) {
          urls.add(citation.url);
        }
      }
    }
    if (block.type === "web_search_tool_result") {
      const result = block.content;
      if (Array.isArray(result)) {
        for (const item of result) {
          if (item.type === "web_search_result" && item.url) urls.add(item.url);
        }
      }
    }
  }

  return { text: texts.join("\n\n"), citedUrls: Array.from(urls) };
}
