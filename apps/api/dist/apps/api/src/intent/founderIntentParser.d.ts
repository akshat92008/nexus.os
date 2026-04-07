/**
 * Founder Experience Layer — Intent Parser
 *
 * Categorizes raw user input into business-specific mission types.
 * Standardizes market, niche, and urgency for startup-related goals.
 */
export type FounderIntentType = 'lead_generation' | 'market_research' | 'competitor_analysis' | 'growth_strategy' | 'content_creation' | 'sales_pipeline' | 'swot_analysis' | 'product_strategy';
export interface FounderIntent {
    type: FounderIntentType;
    market?: string;
    niche?: string;
    urgency: 'low' | 'medium' | 'high';
    outputFormat: 'report' | 'table' | 'tasks';
}
export declare function parseFounderIntent(input: string): FounderIntent;
//# sourceMappingURL=founderIntentParser.d.ts.map