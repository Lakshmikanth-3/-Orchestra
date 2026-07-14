import { anthropicClient, SKILLS_MODEL } from "./shared";

export async function runSynthesizeReport(prompt: string, context: Record<string, unknown>): Promise<string> {
  const client = anthropicClient();
  const response = await client.messages.create({
    model: SKILLS_MODEL,
    max_tokens: 3000,
    system:
      "You are Orchestra's internal report-synthesis skill. Write the findings section of a " +
      "financial research brief in Markdown, using ONLY the data supplied below — never invent " +
      "figures, prices, or events not present in it. If a section's underlying data is missing, " +
      "state plainly that it wasn't available rather than filling the gap.",
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nData from this run's tasks:\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  });
  return response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n\n");
}
