export type FounderIntentType =
  | 'lead_generation'
  | 'market_research'
  | 'swot_analysis'
  | 'product_strategy';

export interface FounderIntent {
  type: FounderIntentType;
  niche?: string;
  rawInput?: string;
}

export function parseFounderIntent(input: string): FounderIntent {
  const lower = input.toLowerCase();

  if (lower.includes('swot')) return { type: 'swot_analysis', rawInput: input };
  if (lower.includes('product')) return { type: 'product_strategy', rawInput: input };
  if (lower.includes('lead')) return { type: 'lead_generation', rawInput: input };

  return {
    type: 'market_research',
    niche: input,
    rawInput: input,
  };
}

