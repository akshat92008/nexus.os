import { llmRouter } from '../llm/LLMRouter.js';
import { integrationManager } from '../integrations/integrationManager.js';
import { logger } from '../logger.js';

export interface WorkflowStep {
  id: string;
  action: string;
  driver: string;
  payload: any;
}

class Orchestrator {
  async executePlan(plan: WorkflowStep[], userId: string): Promise<any[]> {
    logger.info(`[Orchestrator] Executing plan with ${plan.length} steps`);
    const results = [];
    
    for (const step of plan) {
      logger.info(`[Orchestrator] Step ${step.id}: Executing ${step.action} on ${step.driver}`);
      try {
        const result = await integrationManager.execute(step.driver, step.action, step.payload);
        results.push({ stepId: step.id, status: 'success', result });
        
        // Brief delay between steps to simulate real work and avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        logger.error(`[Orchestrator] Step ${step.id} failed: ${err.message}`);
        results.push({ stepId: step.id, status: 'error', error: err.message });
      }
    }
    
    return results;
  }
}

export const orchestrator = new Orchestrator();
