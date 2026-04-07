import { planMission } from '../missionPlanner.js';
import { routeIntent } from '../intentRouter.js';
/**
 * Detects the core intent category of a user goal.
 * Uses a heuristic match or can be expanded to LLM classification.
 */
export function detectIntentCategory(goal) {
    const lower = goal.toLowerCase();
    if (lower.includes('learn') || lower.includes('study') || lower.includes('exam') || lower.includes('assignment')) {
        return 'learning';
    }
    if (lower.includes('business') || lower.includes('startup') || lower.includes('market') || lower.includes('lead')) {
        return 'business';
    }
    if (lower.includes('code') || lower.includes('build') || lower.includes('script') || lower.includes('prototype') || lower.includes('debug') || lower.includes('refactor') || lower.includes('test')) {
        return 'coding';
    }
    if (lower.includes('analyze') || lower.includes('research') || lower.includes('find out') || lower.includes('swot') || lower.includes('strategy')) {
        return 'research';
    }
    if (lower.includes('organize') || lower.includes('manage') || lower.includes('schedule')) {
        return 'productivity';
    }
    return 'general';
}
/**
 * The main entry point for planning a mission based on the detected intent.
 */
export async function planUniversalMission(goal, preferredMode) {
    const category = detectIntentCategory(goal);
    // Resolve the active mode
    let activeMode = 'student';
    if (preferredMode === 'founder' || preferredMode === 'developer' || preferredMode === 'student') {
        activeMode = preferredMode;
    }
    else {
        // Mode Auto-detection if none specified
        if (category === 'business')
            activeMode = 'founder';
        else if (category === 'coding')
            activeMode = 'developer';
    }
    try {
        const { intent, tasks, formatter } = routeIntent(goal, activeMode);
        console.log(`[UniversalIntentEngine] Mission starting via ${activeMode.toUpperCase()} layer.`);
        return {
            missionId: crypto.randomUUID(),
            goal,
            goalType: category === 'coding' ? 'code' : category === 'business' ? 'strategy' : 'research',
            successCriteria: [`Successful execution of ${activeMode} mission: ${intent.type || 'goal'}`],
            nodes: tasks,
            estimatedWaves: tasks.length > 5 ? 4 : 3,
            metadata: {
                mode: activeMode,
                intent,
            },
        };
    }
    catch (err) {
        console.warn('[UniversalIntentEngine] Specialized mode mapping failed, falling back to general planner.', err);
        return await planMission(goal);
    }
}
//# sourceMappingURL=universalIntentEngine.js.map