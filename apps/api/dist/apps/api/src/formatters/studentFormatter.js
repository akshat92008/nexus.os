/**
 * Student Experience Layer — Output Formatter
 *
 * Transforms raw mission synthesis into a structured StudentOutput.
 * This is the final step for student-mode missions before workspace generation.
 */
export function formatStudentOutput(rawData) {
    // If the synthesizers already produced the correct format, use it
    const d = rawData.deliverable || {};
    return {
        explanation: d.explanation || rawData.executiveSummary || 'Explanation in progress...',
        keyPoints: Array.isArray(d.keyPoints) ? d.keyPoints : rawData.keyInsights?.map((i) => i.insight) || [],
        notes: d.notes || rawData.executiveSummary || 'Notes in progress...',
        questions: Array.isArray(d.questions) ? d.questions : d.mockExamQuestions || [],
        quickRevision: d.quickRevision || d.quickRevisionSummary || 'Quick revision logic active.',
    };
}
//# sourceMappingURL=studentFormatter.js.map