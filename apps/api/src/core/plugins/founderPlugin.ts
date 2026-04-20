import { TaskDAG } from '@nexus-os/types';
import { PlanningPlugin } from '../planningPlugin.js';
import { parseFounderIntent } from '../../intent/founderIntentParser.js';
import { mapFounderIntentToTasks } from '../../mappers/founderTaskMapper.js';

export class FounderPlanningPlugin implements PlanningPlugin {
  name = 'founder';

  canHandle(input: string): boolean {
    // Legacy logic: typically determined by user selection, 
    // but we can add heuristic detection here if needed.
    return input.toLowerCase().includes('business') || 
           input.toLowerCase().includes('startup') || 
           input.toLowerCase().includes('market');
  }

  async generatePlan(input: string): Promise<TaskDAG> {
    const intent = parseFounderIntent(input);
    const tasks = mapFounderIntentToTasks(intent);
    
    return {
      missionId: `founder_${crypto.randomUUID().slice(0, 8)}`,
      goal: input,
      goalType: 'strategy',
      successCriteria: ['Completed founder-led market analysis and strategy'],
      nodes: tasks,
      estimatedWaves: 3
    };
  }
}
