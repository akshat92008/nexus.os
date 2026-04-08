import { planMission } from '../missionPlanner.js';
import { routeIntent, type OSMode } from '../intentRouter.js';
import type { TaskDAG, GoalType } from '@nexus-os/types';

export type IntentCategory = 'learning' | 'business' | 'productivity' | 'research' | 'coding' | 'general';

/**
 * Detects the core intent category of a user goal.
 * Uses a heuristic match or can be expanded to LLM classification.
 */
export function detectIntentCategory(goal: string): IntentCategory {
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
export async function planUniversalMission(goal: string, preferredMode?: string): Promise<TaskDAG> {
  const category = detectIntentCategory(goal);
  
  // Resolve the active mode
  let activeMode: OSMode = 'student';
  if (preferredMode === 'founder' || preferredMode === 'developer' || preferredMode === 'student') {
    activeMode = preferredMode as OSMode;
  } else {
    // Mode Auto-detection if none specified
    if (category === 'business') activeMode = 'founder';
    else if (category === 'coding') activeMode = 'developer';
  }

  try {
    const { intent, tasks, formatter } = await routeIntent(goal, activeMode);
    
    console.log(`[UniversalIntentEngine] Mission starting via ${activeMode.toUpperCase()} layer.`);

    return {
      missionId: crypto.randomUUID(),
      goal,
      goalType: category === 'coding' ? 'code' : category === 'business' ? 'strategy' : 'research' as GoalType,
      successCriteria: [`Successful execution of ${activeMode} mission: ${intent.type || 'goal'}`],
      nodes: tasks,
      estimatedWaves: tasks.length > 5 ? 4 : 3,
      metadata: {
        mode: activeMode,
        intent,
      },
    } as any;

  } catch (err) {
    console.warn('[UniversalIntentEngine] Specialized mode mapping failed, falling back to general planner.', err);
    return await planMission(goal);
  }
}
