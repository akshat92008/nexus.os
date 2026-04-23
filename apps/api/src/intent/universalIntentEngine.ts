import { planMission } from '../missionPlanner.js';
import { routeIntent, type OSMode } from '../intentRouter.js';
import { llmRouter } from '../llm/LLMRouter.js';
import { MODEL_FAST } from '../agents/agentConfig.js';
import type { TaskDAG, GoalType } from '@nexus-os/types';

export type IntentCategory = 'learning' | 'business' | 'productivity' | 'research' | 'coding' | 'general';

const INTENT_CLASSIFIER_PROMPT = `Classify the user's goal into exactly one category.
Categories:
- learning: studying, homework, exams, understanding concepts, assignments
- business: startups, fundraising, pitch, investors, GTM, revenue, hiring, legal, CRM, sales, leads, competitors, market research, OKRs, equity, burn rate
- coding: writing code, debugging, refactoring, git, scripts, APIs, testing, CI/CD, architecture
- research: analysis, industry research, SWOT, trends, finding information
- productivity: scheduling, tasks, organizing, time management, project management
- general: everything else

Respond with ONLY valid JSON: {"category": "<one of the 6 categories>", "confidence": <0.0-1.0>}
No other text. No markdown.`;

// Cache to avoid re-classifying identical goals in the same session
const classifyCache = new Map<string, IntentCategory>();

export async function detectIntentCategory(goal: string): Promise<IntentCategory> {
  // Fast path: check cache
  const cached = classifyCache.get(goal);
  if (cached) return cached;

  // Fast path: obvious direct actions stay general
  const lower = goal.toLocaleLowerCase();
  if (lower.startsWith('open ') || lower.startsWith('launch ') ||
      lower.startsWith('click ') || lower.startsWith('type ')) {
    return 'general';
  }

  try {
    const response = await llmRouter.call({
      model: MODEL_FAST,
      system: INTENT_CLASSIFIER_PROMPT,
      user: goal,
      temperature: 0.0,
      maxTokens: 60,
    });

    const raw = response.content.trim().replace(/```json|```/g, '');
    const parsed = JSON.parse(raw);
    const category = parsed.category as IntentCategory;

    // Validate it's a known category, fallback to general
    const valid: IntentCategory[] = ['learning', 'business', 'coding', 'research', 'productivity', 'general'];
    const result: IntentCategory = valid.includes(category) ? category : 'general';

    // Cache it for this session
    classifyCache.set(goal, result);
    return result;

  } catch {
    // Keyword fallback if LLM is unavailable
    if (lower.includes('learn') || lower.includes('study') || lower.includes('exam')) return 'learning'; // fallback
    if (lower.includes('code') || lower.includes('debug') || lower.includes('git')) return 'coding';
    if (lower.includes('business') || lower.includes('startup') || lower.includes('pitch')) return 'business';
    return 'general';
  }
}

/**
 * The main entry point for planning a mission based on the detected intent.
 */
export async function planUniversalMission(goal: string, preferredMode?: string): Promise<TaskDAG> {
  const lower = goal.toLocaleLowerCase();

  // --- PILLAR: DIRECT OS ACTION BYPASS ---
  // If the user input is a direct "Open/Search/Launch" command, we bypass persona-mashing
  // and create a high-precision Direct Action Node. This fixes the "Doing Nothing" bug.
  const isDirectAction = 
    lower.startsWith('open ') || 
    lower.startsWith('launch ') || 
    lower.startsWith('search ') || 
    lower.startsWith('find ') ||
    lower.startsWith('type ') ||
    lower.startsWith('click ');

  if (isDirectAction) {
    console.log(`[UniversalIntentEngine] ⚡ Direct OS Action detected: "${goal}"`);
    return {
      missionId: crypto.randomUUID(),
      goal,
      goalType: 'general',
      successCriteria: [`Direct execution of OS command: ${goal}`],
      nodes: [{
        id: 'direct_os_action',
        label: goal, // masterBrain's ActionMapper will use this label
        agentType: 'executor',
        dependencies: [],
        contextFields: [],
        priority: 'critical',
        maxRetries: 1,
        expectedOutput: { format: 'prose', example: 'Action performed successfully.' },
        goalAlignment: 1.0,
      }],
      estimatedWaves: 1,
      metadata: { mode: 'founder' as OSMode, intent: { type: 'direct_action' } },
    } as any;
  }

  const category = await detectIntentCategory(goal);
  
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
