const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// Neither Groq call previously carried a timeout, so a slow/unreachable Groq
// API could hang the request indefinitely -- including the paid orchestrate
// POST, which awaits generatePlan (and therefore this fetch) before it ever
// responds. A platform test hitting that path saw no response at all rather
// than a fast, itemized error. Bounding it here fails loudly instead.
const GROQ_TIMEOUT_MS = 30_000;

export class GroqError extends Error {}

async function fetchGroq(body: Record<string, unknown>): Promise<Response> {
  try {
    return await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new GroqError(`Groq request timed out after ${GROQ_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

interface GroqChatOptions {
  system: string;
  user: string;
  maxTokens: number;
  /** When set, forces the response to strictly match this JSON Schema (Groq's structured outputs). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

/** Calls Groq's OpenAI-compatible chat completions endpoint for real. Never fabricates a response. */
export async function groqChat({ system, user, maxTokens, jsonSchema }: GroqChatOptions): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new GroqError("GROQ_API_KEY is not set");
  }

  const res = await fetchGroq({
    model: GROQ_MODEL,
    max_tokens: maxTokens,
    // gpt-oss models spend part of max_tokens "thinking" before writing the
    // real answer; without capping that at "low" a small max_tokens budget
    // (e.g. the planner's 1200) can be exhausted by reasoning alone, leaving
    // truncated/empty content with finish_reason "length".
    reasoning_effort: "low",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(jsonSchema
      ? { response_format: { type: "json_schema", json_schema: { name: jsonSchema.name, strict: true, schema: jsonSchema.schema } } }
      : {}),
  });

  if (!res.ok) {
    throw new GroqError(`Groq chat completion failed: HTTP ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new GroqError(`Groq response had no message content (finish_reason=${body.choices?.[0]?.finish_reason})`);
  }
  return content;
}

export const GROQ_AGENTIC_MODEL = process.env.GROQ_AGENTIC_MODEL || "groq/compound-mini";

export interface GroqAgenticResult {
  text: string;
  citedUrls: string[];
}

/**
 * Calls Groq's Compound system, which runs a real, live web search server-side
 * when it decides the query needs one. Citations are pulled from the real
 * search_results Groq's own tool call returned -- never invented.
 */
export async function groqAgenticChat({ system, user, maxTokens }: { system: string; user: string; maxTokens: number }): Promise<GroqAgenticResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new GroqError("GROQ_API_KEY is not set");
  }

  const res = await fetchGroq({
    model: GROQ_AGENTIC_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  if (!res.ok) {
    throw new GroqError(`Groq agentic chat completion failed: HTTP ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  const message = body.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new GroqError(`Groq agentic response had no message content (finish_reason=${body.choices?.[0]?.finish_reason})`);
  }

  const citedUrls = new Set<string>();
  for (const tool of message?.executed_tools ?? []) {
    for (const result of tool?.search_results?.results ?? []) {
      if (typeof result?.url === "string") citedUrls.add(result.url);
    }
  }

  return { text: content, citedUrls: Array.from(citedUrls) };
}
