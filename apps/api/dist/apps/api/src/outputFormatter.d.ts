import type { GoalType, SynthesisArtifact, LeadProfile, PipelineStage, Workspace, TypedArtifact } from '../../../packages/types/index.js';
export interface LeadGenOutput {
    niche: string;
    executiveSummary: string;
    leads: LeadProfile[];
    pipeline?: {
        stages: PipelineStage[];
        recommendedCRM?: string;
    };
    outreachMessages?: Array<{
        leadCompany: string;
        subject: string;
        body: string;
    }>;
    keyInsights: string[];
    gaps: string[];
    nextSteps: Array<{
        action: string;
        timeframe: string;
        priority: string;
    }>;
}
export interface ResearchOutput {
    executiveSummary: string;
    keyInsights: Array<{
        insight: string;
        confidence: string;
    }>;
    recommendations: string[];
    gaps: string[];
    nextSteps: Array<{
        action: string;
        timeframe: string;
    }>;
}
export interface StrategyOutput {
    executiveSummary: string;
    roadmap: Array<{
        phase: string;
        actions: string[];
        timeline: string;
    }>;
    risks: Array<{
        risk: string;
        mitigation: string;
    }>;
    quickWins: string[];
    nextSteps: Array<{
        action: string;
        timeframe: string;
    }>;
}
export interface GeneralOutput {
    executiveSummary: string;
    keyInsights: Array<{
        insight: string;
        confidence: string;
    }>;
    deliverable: Record<string, unknown>;
    gaps: string[];
    nextSteps: Array<{
        action: string;
        timeframe: string;
    }>;
}
export type FormattedOutput = {
    goalType: 'lead_gen';
    data: LeadGenOutput;
} | {
    goalType: 'research';
    data: ResearchOutput;
} | {
    goalType: 'strategy';
    data: StrategyOutput;
} | {
    goalType: 'content';
    data: GeneralOutput;
} | {
    goalType: 'analysis';
    data: GeneralOutput;
} | {
    goalType: 'code';
    data: GeneralOutput;
} | {
    goalType: 'general';
    data: GeneralOutput;
};
export declare class OutputValidationError extends Error {
    constructor(message: string);
}
export declare function transformToWorkspace(synthesis: SynthesisArtifact, goal: string, goalType: GoalType, missionId: string, intermediateArtifacts: Map<string, TypedArtifact>): Workspace;
export declare function formatStudentToWorkspace(rawStudentData: any, // StudentOutput
goal: string, missionId: string): Workspace;
/**
 * formatFounderToWorkspace
 *
 * Specialized transformation for Founder Mode.
 * Maps FounderOutput fields to boardroom-ready sections.
 */
export declare function formatFounderToWorkspace(rawFounderData: any, goal: string, missionId: string): Workspace;
/**
 * formatDeveloperToWorkspace
 *
 * Specialized transformation for Developer Mode.
 * Focuses on Code Studio, Technical Steps, and Improvements.
 */
export declare function formatDeveloperToWorkspace(rawDevData: any, goal: string, missionId: string): Workspace;
export declare function formatOutput(synthesis: SynthesisArtifact, goalType: GoalType): FormattedOutput;
export declare function formattedOutputToLegacyContent(output: FormattedOutput): string;
//# sourceMappingURL=outputFormatter.d.ts.map