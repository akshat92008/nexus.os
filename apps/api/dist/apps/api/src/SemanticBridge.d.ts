/**
 * Nexus OS — Semantic Bridge (Context Compression Engine)
 *
 * This module addresses "Context Saturation" by digesting raw agent
 * artifacts into a structured "Mission World-State" or "Briefing".
 */
import type { TaskNode, MemoryEntry } from '../../../packages/types/index.js';
export interface MissionWorldState {
    summary: string;
    keyInsights: Array<{
        insight: string;
        source: string;
    }>;
    verifiedData: Record<string, any>;
    unresolvedGaps: string[];
    suggestedFocus: string;
}
export declare class SemanticBridge {
    /**
     * Synthesizes all prior artifacts into a structured World-State briefing.
     */
    synthesizeBriefing(goal: string, artifacts: MemoryEntry[], targetTask: TaskNode): Promise<string>;
}
export declare const semanticBridge: SemanticBridge;
//# sourceMappingURL=SemanticBridge.d.ts.map