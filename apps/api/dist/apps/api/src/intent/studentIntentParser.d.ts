/**
 * Student Experience Layer — Intent Parser
 *
 * Categorizes raw user input into student-specific mission types.
 * Standardizes depth and format requirements for academic goals.
 */
export type StudentIntentType = 'explain_topic' | 'finish_assignment' | 'exam_preparation' | 'summarize_notes' | 'project_help';
export interface StudentIntent {
    type: StudentIntentType;
    subject?: string;
    depth: 'low' | 'medium' | 'high';
    outputFormat: 'notes' | 'qa' | 'summary';
}
export declare function parseStudentIntent(input: string): StudentIntent;
//# sourceMappingURL=studentIntentParser.d.ts.map