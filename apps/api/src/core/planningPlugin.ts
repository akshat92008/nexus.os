import { TaskDAG } from '@nexus-os/types';

/**
 * A PlanningPlugin represents a specialized intent-to-DAG mapper.
 * It allows Nexus OS to support different domain-specific planning logics
 * (e.g. Founder, Developer, Student) as pluggable modules.
 */
export interface PlanningPlugin {
  name: string;
  
  /**
   * Determines if this plugin can handle the given user input.
   */
  canHandle(input: string): boolean;
  
  /**
   * Generates a TaskDAG based on the user input.
   */
  generatePlan(input: string): Promise<TaskDAG>;
}
