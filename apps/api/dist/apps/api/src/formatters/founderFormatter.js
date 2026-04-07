/**
 * Founder Experience Layer — Formatter
 *
 * Transforms the final synthesized artifacts into a unified boardroom report.
 */
export function formatFounderOutput(synthesis) {
    return {
        executiveSummary: synthesis.executiveSummary || 'No summary available.',
        keyInsights: synthesis.keyInsights || [],
        opportunities: synthesis.opportunities || [],
        risks: synthesis.risks || [],
        actionPlan: synthesis.actionPlan || [],
        metrics: synthesis.metrics || ['100% mission alignment'],
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=founderFormatter.js.map