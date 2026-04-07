/**
 * Founder Experience Layer — Intent Parser
 *
 * Categorizes raw user input into business-specific mission types.
 * Standardizes market, niche, and urgency for startup-related goals.
 */
export function parseFounderIntent(input) {
    const lower = input.toLowerCase();
    // 1. Determine Intent Type
    let type = 'growth_strategy';
    if (lower.includes('lead') || lower.includes('email') || lower.includes('client') || lower.includes('prospect')) {
        type = 'lead_generation';
    }
    else if (lower.includes('market') || lower.includes('trends') || lower.includes('industry') || lower.includes('finding')) {
        type = 'market_research';
    }
    else if (lower.includes('competitor') || lower.includes('rival') || lower.includes('vs') || lower.includes('analysis of other')) {
        type = 'competitor_analysis';
    }
    else if (lower.includes('content') || lower.includes('write') || lower.includes('post') || lower.includes('marketing')) {
        type = 'content_creation';
    }
    else if (lower.includes('sales') || lower.includes('pipeline') || lower.includes('funnel') || lower.includes('closing')) {
        type = 'sales_pipeline';
    }
    else if (lower.includes('swot') || lower.includes('strength') || lower.includes('weakness') || lower.includes('opportunity')) {
        type = 'swot_analysis';
    }
    else if (lower.includes('product') || lower.includes('feature') || lower.includes('roadmap') || lower.includes('mvp')) {
        type = 'product_strategy';
    }
    // 2. Extract Basic Context (Simplified)
    let niche = '';
    const nicheMatch = lower.match(/(?:for|in|about)\s+([^?.!,]+)/i);
    if (nicheMatch) {
        niche = nicheMatch[1].trim();
    }
    else {
        // Take 2 words for context if no preposition found
        niche = input.split(' ').slice(-2).join(' ');
    }
    // 3. Determine Urgency
    let urgency = 'medium';
    if (lower.includes('asap') || lower.includes('urgent') || lower.includes('immediately')) {
        urgency = 'high';
    }
    else if (lower.includes('someday') || lower.includes('long term') || lower.includes('eventually')) {
        urgency = 'low';
    }
    // 4. Default Output Format per Intent
    let outputFormat = 'report';
    if (type === 'lead_generation')
        outputFormat = 'table';
    if (type === 'sales_pipeline')
        outputFormat = 'tasks';
    return { type, niche, urgency, outputFormat };
}
//# sourceMappingURL=founderIntentParser.js.map