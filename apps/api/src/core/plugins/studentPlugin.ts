import { TaskDAG } from '@nexus-os/types';
import { PlanningPlugin } from '../planningPlugin.js';
import { parseStudentIntent } from '../../intent/studentIntentParser.js';
import { mapIntentToTasks as mapStudentTasks } from '../../intent/studentTaskMapper.js';

export class StudentPlanningPlugin implements PlanningPlugin {
  name = 'student';

  canHandle(input: string): boolean {
    // Default fallback or specific student keywords
    return input.toLowerCase().includes('study') || 
           input.toLowerCase().includes('exam') || 
           input.toLowerCase().includes('learn') || 
           input.toLowerCase().includes('explain');
  }

  async generatePlan(input: string): Promise<TaskDAG> {
    const intent = parseStudentIntent(input);
    const tasks = mapStudentTasks(intent);
    
    return {
      missionId: `student_${crypto.randomUUID().slice(0, 8)}`,
      goal: input,
      goalType: 'research',
      successCriteria: ['Completed student-led study guide generation'],
      nodes: tasks,
      estimatedWaves: 3
    };
  }
}
