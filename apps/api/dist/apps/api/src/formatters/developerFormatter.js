/**
 * Developer Experience Layer — Formatter
 *
 * Transforms the final synthesized artifacts into a unified engineering guide.
 */
export function formatDeveloperOutput(synthesis) {
    return {
        explanation: synthesis.explanation || 'No documentation available.',
        code: synthesis.code || '',
        steps: synthesis.steps || [],
        improvements: synthesis.improvements || [],
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=developerFormatter.js.map