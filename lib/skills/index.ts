import type { Capability } from "../schema";
import { runNewsScan } from "./news-scan";
import { runRiskFlags } from "./risk-flags";
import { runSynthesizeReport } from "./synthesize-report";

export interface InternalSkillOutput {
  kind: "internal";
  capability: Capability;
  text: string;
  citedUrls: string[];
}

export async function runInternalSkill(
  capability: Exclude<Capability, "market_data">,
  prompt: string,
  context: Record<string, unknown>
): Promise<InternalSkillOutput> {
  switch (capability) {
    case "news_scan": {
      const { text, citedUrls } = await runNewsScan(prompt);
      return { kind: "internal", capability, text, citedUrls };
    }
    case "risk_flags": {
      const { text, citedUrls } = await runRiskFlags(prompt, context);
      return { kind: "internal", capability, text, citedUrls };
    }
    case "synthesize_report": {
      const text = await runSynthesizeReport(prompt, context);
      return { kind: "internal", capability, text, citedUrls: [] };
    }
  }
}
