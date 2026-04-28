import { llmRouter, MODEL_POWER } from '../llm/LLMRouter.js';
import { logger } from '../logger.js';

export interface WorkflowNode {
  id: string;
  tool: string;
  target_app: string;
  action_description: string;
  dependencies: string[];
}

export interface CompiledAgent {
  name: string;
  trigger: string; // e.g., "manual", "every monday at 9am"
  nodes: WorkflowNode[];
}

const COMPILER_PROMPT = `
You are the Nexus OS Workflow Compiler.
The user will describe a task they want to automate across their existing software (Excel, PowerPoint, Web Browsers, etc.).
Your job is to break this request down into a Directed Acyclic Graph (DAG) of atomic actions.

Available Tool Categories:
- mcp_api: For interacting with known APIs (Google Workspace, Slack, Notion).
- gui_control: For natively clicking/typing in local macOS apps (PowerPoint, Safari).
- reasoning: For analyzing data between steps.

You MUST respond ONLY in valid JSON matching this structure:
{
  "name": "Short Agent Name",
  "trigger": "When this should run",
  "nodes":[
    {
      "id": "step_1",
      "tool": "mcp_api",
      "target_app": "Google Sheets",
      "action_description": "Fetch rows where status is 'New'",
      "dependencies": []
    },
    {
      "id": "step_2",
      "tool": "gui_control",
      "target_app": "PowerPoint",
      "action_description": "Create a new slide with the fetched data",
      "dependencies": ["step_1"]
    }
  ]
}
`;

/**
 * Compiles a natural language prompt into a structured agent workflow.
 */
export async function compilePromptToAgent(userPrompt: string): Promise<CompiledAgent> {
  logger.info({ userPrompt: userPrompt.slice(0, 50) }, '[AgentCompiler] 🧠 Compiling user request into Agent Workflow...');
  
  try {
    const rawResponse = await llmRouter.callSimple(COMPILER_PROMPT, userPrompt, MODEL_POWER, true);
    
    // Clean and parse the JSON
    const jsonString = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const compiled = JSON.parse(jsonString);
    
    // Basic validation
    if (!compiled.name || !compiled.nodes || !Array.isArray(compiled.nodes)) {
       throw new Error('Invalid compiler output structure');
    }
    
    return compiled as CompiledAgent;
  } catch (error: any) {
    logger.error({ error: error.message }, '[AgentCompiler] ❌ Compilation failed');
    throw error;
  }
}
