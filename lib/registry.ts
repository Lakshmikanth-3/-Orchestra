import type { Capability } from "./schema";

export type ProviderKind = "external_asp" | "internal";

export interface CapabilityProvider {
  kind: ProviderKind;
  name: string;
}

export const REGISTRY: Record<Capability, CapabilityProvider> = {
  market_data: { kind: "external_asp", name: "CoinAnk" },
  news_scan: { kind: "internal", name: "Orchestra internal skill" },
  risk_flags: { kind: "internal", name: "Orchestra internal skill" },
  synthesize_report: { kind: "internal", name: "Orchestra internal skill" },
};

export function providerFor(capability: Capability): CapabilityProvider {
  return REGISTRY[capability];
}
