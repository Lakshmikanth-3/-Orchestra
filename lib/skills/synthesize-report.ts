import { groqChat } from "../groq";

export async function runSynthesizeReport(prompt: string, context: Record<string, unknown>): Promise<string> {
  return groqChat({
    system:
      "You are Orchestra's internal report-synthesis skill. Write the findings section of a " +
      "financial research brief in Markdown, using ONLY the data supplied below — never invent " +
      "figures, prices, or events not present in it. If a section's underlying data is missing, " +
      "state plainly that it wasn't available rather than filling the gap.",
    user: `${prompt}\n\nData from this run's tasks:\n${JSON.stringify(context, null, 2)}`,
    maxTokens: 3000,
  });
}
