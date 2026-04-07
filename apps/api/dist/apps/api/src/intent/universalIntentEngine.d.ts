import type { TaskDAG } from '../../../../packages/types/index.js';
export type IntentCategory = 'learning' | 'business' | 'productivity' | 'research' | 'coding' | 'general';
/**
 * Detects the core intent category of a user goal.
 * Uses a heuristic match or can be expanded to LLM classification.
 */
export declare function detectIntentCategory(goal: string): IntentCategory;
/**
 * The main entry point for planning a mission based on the detected intent.
 */
export declare function planUniversalMission(goal: string, preferredMode?: string): Promise<TaskDAG>;
//# sourceMappingURL=universalIntentEngine.d.ts.map