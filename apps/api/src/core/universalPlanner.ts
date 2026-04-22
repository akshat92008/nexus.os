import { TaskDAG, TaskNode, AgentType, OutputFormat, TaskPriority } from '@nexus-os/types';
import { PlanningPlugin } from './planningPlugin.js';
import { FounderPlanningPlugin } from './plugins/founderPlugin.js';
import { DeveloperPlanningPlugin } from './plugins/developerPlugin.js';
import { StudentPlanningPlugin } from './plugins/studentPlugin.js';

/**
 * UniversalPlanner is the "primitive-first" planning layer for Nexus OS.
 * It uses a set of PlanningPlugins (legacy mappers) to generate TaskDAGs,
 * and falls back to a generic planning logic if no specialized plugin matches.
 */
class UniversalPlanner {
  private plugins: PlanningPlugin[] = [];

  constructor() {
    // Register legacy mappers as plugins for backward compatibility
    this.registerPlugin(new FounderPlanningPlugin());
    this.registerPlugin(new DeveloperPlanningPlugin());
    this.registerPlugin(new StudentPlanningPlugin());
  }

  /**
   * Register a new planning plugin.
   */
  registerPlugin(plugin: PlanningPlugin) {
    this.plugins.push(plugin);
    console.log(`[UniversalPlanner] 🔌 Plugin registered: ${plugin.name}`);
  }

  /**
   * Main planning entry point.
   */
  async plan(input: string, mode: 'legacy' | 'os' = 'os'): Promise<TaskDAG> {
    console.log(`[UniversalPlanner] 🎯 Planning mission (Mode: ${mode}): "${input.slice(0, 50)}..."`);

    // 1. Try specialized plugins (Legacy mode logic)
    for (const plugin of this.plugins) {
      if (plugin.canHandle(input)) {
        console.log(`[UniversalPlanner] ✅ Delegating to specialized plugin: ${plugin.name}`);
        return await plugin.generatePlan(input);
      }
    }

    // 2. Generic Planning (OS-first logic)
    // In OS mode, we might want to skip specialized logic and use a more general AI-driven planner.
    // For now, this fallback provides a baseline.
    return this.generateGenericPlan(input);
  }

  /**
   * Generates a generic TaskDAG as a primitive fallback.
   */
  private async generateGenericPlan(input: string): Promise<TaskDAG> {
    const missionId = `mission_${crypto.randomUUID().slice(0, 8)}`;
    
    // Primitive fallback: A simple Research -> Analyze -> Summarize chain
    const nodes: TaskNode[] = [
      {
        id: 'task_research',
        label: `Researching: ${input}`,
        agentType: 'researcher',
        dependencies: [],
        expectedOutput: { format: 'prose', example: 'Detailed research findings...' },
        contextFields: [],
        goalAlignment: 1,
        priority: 'high',
        maxRetries: 3
      },
      {
        id: 'task_analysis',
        label: `Analyzing findings for: ${input}`,
        agentType: 'analyst',
        dependencies: ['task_research'],
        expectedOutput: { format: 'structured_json', example: '{"insights": ["..."]}' },
        contextFields: ['task_research'],
        goalAlignment: 1,
        priority: 'medium',
        maxRetries: 3
      }
    ];

    return {
      missionId,
      goal: input,
      goalType: 'general',
      successCriteria: ['Completed general research and analysis'],
      nodes,
      estimatedWaves: 2
    };
  }
}

export const universalPlanner = new UniversalPlanner();
