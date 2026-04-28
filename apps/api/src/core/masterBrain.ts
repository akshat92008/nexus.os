import { llmRouter } from '../llm/LLMRouter.js';
import { orchestrator, WorkflowStep } from './orchestrator.js';
import { integrationManager } from '../integrations/integrationManager.js';
import { logger } from '../logger.js';
import { randomUUID } from 'crypto';

const SYSTEM_PROMPT = `You are the Nexus OS MasterBrain, an advanced agentic core.
Your job is to interpret user commands and generate an execution plan using available drivers.

Available Drivers: slack, gmail, notion, hubspot, calendar, docs, search, github, email.
Available Sales Tasks: process_leads, run_outreach, follow_up, status_report.

Generate a JSON array of steps. Each step must have:
- "action": string (the action to perform, e.g. "send_message", "search_docs", "process_leads")
- "driver": string (use "sales" for Sales Tasks, or one of the Available Drivers)
- "payload": object (any parameters needed for the action)

Example Output:
[
  { "action": "fetch_recent", "driver": "slack", "payload": { "channel": "sales" } },
  { "action": "create_page", "driver": "notion", "payload": { "title": "Sales Report" } }
]

Output ONLY valid JSON. No markdown blocks. If the command is a question or conversational, just return an empty array and include your response in a separate field. Wait, to handle conversation AND actions, output this exact JSON shape:
{
  "response": "A direct text response to the user",
  "plan": [ array of steps ]
}`;

class MasterBrain {
  async processCommand(command: string, userId: string): Promise<{ response: string; results?: any[] }> {
    logger.info(`[MasterBrain] Processing command: ${command}`);
    
    try {
      const driverStatus = JSON.stringify(integrationManager.getStatus());
      const context = `User Command: ${command}\n\nCurrent Driver Status:\n${driverStatus}\nDo not plan actions for disconnected drivers unless you specifically tell the user they need to connect them.`;

      const raw = await llmRouter.callSimple(SYSTEM_PROMPT, context, 'MODEL_SMART', true);
      
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return { response: "I had trouble understanding that command. Could you rephrase?" };
      }

      const responseText = parsed.response || "Executing your command...";
      let plan = parsed.plan || [];

      if (!Array.isArray(plan)) {
        plan = [];
      }

      if (plan.length === 0) {
        return { response: responseText };
      }

      // Add IDs to steps
      const executablePlan: WorkflowStep[] = plan.map((p: any) => ({
        id: randomUUID(),
        action: p.action,
        driver: p.driver,
        payload: p.payload || {}
      }));

      // Execute the plan
      const executionResults = [];
      for (const step of executablePlan) {
        if (step.driver === 'sales') {
           const { taskRunner } = await import('./taskRunner.js');
           try {
             const res = await taskRunner.runTask(step.action, userId, step.payload);
             executionResults.push({ stepId: step.id, status: 'success', result: res });
           } catch (e: any) {
             executionResults.push({ stepId: step.id, status: 'error', error: e.message });
           }
        } else {
           // Normal driver execution
           const res = await orchestrator.executePlan([step], userId);
           executionResults.push(...res);
        }
      }

      // Summarize results
      const summaryPrompt = `You executed a plan. Here are the results:
${JSON.stringify(executionResults)}
Write a brief, 1-2 sentence summary of what was accomplished.`;
      
      const summary = await llmRouter.callSimple('You are a helpful assistant summarizer.', summaryPrompt, 'MODEL_FAST');

      return { 
        response: summary,
        results: executionResults 
      };

    } catch (err: any) {
      logger.error(`[MasterBrain] Failed to process command: ${err.message}`);
      return { response: `Error executing command: ${err.message}` };
    }
  }
}

export const masterBrain = new MasterBrain();
