/**
 * Student Experience Layer — Output Formatter
 *
 * Transforms raw mission synthesis into a structured StudentOutput.
 * This is the final step for student-mode missions before workspace generation.
 */
export interface StudentOutput {
    explanation: string;
    keyPoints: string[];
    notes: string;
    questions: string[];
    quickRevision: string;
}
export declare function formatStudentOutput(rawData: any): StudentOutput;
//# sourceMappingURL=studentFormatter.d.ts.map