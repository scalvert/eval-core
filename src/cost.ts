export interface Pricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export function calculateCost(pricing: Pricing, inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}
