import { TaskDAG } from '@nexus-os/types';
import { PlanningPlugin } from '../planningPlugin.js';
import { parseDeveloperIntent } from '../../intent/developerIntentParser.js';
import { mapDeveloperIntentToTasks } from '../../mappers/developerTaskMapper.js';

export class DeveloperPlanningPlugin implements PlanningPlugin {
  name = 'developer';

  canHandle(input: string): boolean {
    return input.toLowerCase().includes('code') || 
           input.toLowerCase().includes('build') || 
           input.toLowerCase().includes('debug') || 
           input.toLowerCase().includes('refactor') ||
           input.toLowerCase().includes('architecture');
  }

  async generatePlan(input: string): Promise<TaskDAG> {
    const intent = parseDeveloperIntent(input);
    const tasks = mapDeveloperIntentToTasks(intent);
    
    return {
      missionId: `developer_${crypto.randomUUID().slice(0, 8)}`,
      goal: input,
      goalType: 'code',
      successCriteria: ['Completed developer-led coding mission'],
      nodes: tasks,
      estimatedWaves: 3
    };
  }
}
