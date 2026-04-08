import { TaskNode, GoalType, AgentContext } from '../../../packages/types/index.js';
import { AGENT_ROLES, CONSTRAINTS } from './agentConfig.js';

/**
 * Builds a 4-part prompt: Role+Goal, Output Schema, Constraints, and Context.
 */
export function buildAgentPrompt(
  task: TaskNode,
  goal: string,
  goalType: GoalType,
  context: AgentContext
): { system: string; user: string } {
  // PART 1: Role + Mission Awareness
  const roleBlock =
    `You are a ${AGENT_ROLES[task.agentType]}\n\n` +
    `MISSION GOAL: "${goal}"\n` +
    `GOAL TYPE: ${goalType}\n` +
    `YOUR TASK: ${task.label}\n` +
    `TASK PRIORITY: ${task.priority}` +
    (task.priority === 'critical'
      ? ' — This is a critical deliverable. Do not skip or summarize.'
      : '');

  // PART 2: Output schema enforcement (goal-type-aware)
  const outputInstruction = buildOutputInstruction(task, goalType);

  // PART 3: Anti-hallucination
  const system = roleBlock + '\n' + outputInstruction + '\n' + CONSTRAINTS;

  // PART 4: Context (selective, structured — from MissionMemory.selectiveRead)
  const user =
    (context.promptBlock || '') +
    `\n\nNow produce your output for this task: "${task.label}"\n` +
    `Respond immediately with your output. No preamble.`;

  return { system, user };
}

function buildOutputInstruction(task: TaskNode, goalType: GoalType): string {
  // Lead generation override
  if (
    goalType === 'lead_gen' &&
    task.agentType === 'researcher' &&
    task.expectedOutput.format === 'list'
  ) {
    return buildLeadSchema(task.expectedOutput.minItems ?? 10);
  }

  // Outreach messages override
  if (
    goalType === 'lead_gen' &&
    task.agentType === 'writer' &&
    task.expectedOutput.format === 'list'
  ) {
    return `
OUTPUT FORMAT: Return ONLY a valid JSON object with a "messages" array. No markdown fences.
Required structure:
{
  "messages": [
    {
      "leadName": "Name of the lead this message targets",
      "channel": "email | linkedin | whatsapp",
      "subject": "Specific, personalized subject line referencing their context",
      "body": "3-5 sentence message: opening hook about THEIR pain, your solution, specific CTA",
      "callToAction": "One clear next step (e.g., '15-min call Thursday?')"
    }
  ],
  "rawContent": "X outreach messages generated for [campaign]"
}
Generate one message per lead from the lead list. No generic copy-paste messages.
Each message body must reference the specific painPoint of that lead.`;
  }

  const schema = task.expectedOutput;

  if (schema.format === 'structured_json') {
    const fields = schema.fields
      ? Object.entries(schema.fields)
          .map(([k, v]) => `  "${k}": ${v}`)
          .join(',\n')
      : '  // fields defined by your task';

    return `
OUTPUT FORMAT: Respond ONLY with a valid JSON object. No markdown fences. No explanation before or after.
Required JSON structure:
{
${fields}
}
${schema.example ? `Example value for reference: ${schema.example}` : ''}
Include a "rawContent" field with a 1-2 sentence human-readable summary of your findings.`;
  }

  if (schema.format === 'list') {
    return `
OUTPUT FORMAT: Respond ONLY with a valid JSON object containing a single array field.
The array must contain at least ${schema.minItems ?? 5} items.
Each item must be a complete object with all relevant fields (not a string).
${schema.example ? `Example item: ${schema.example}` : ''}
Include a "rawContent" field: brief summary of the list at the top level.
Do NOT return a plain JSON array — wrap it in an object.`;
  }

  if (schema.format === 'code') {
    return `
OUTPUT FORMAT: Respond ONLY with a valid JSON object:
{
  "language": "the programming language used",
  "code": "the complete code as a single string (use \\n for newlines)",
  "explanation": "2-3 sentences explaining the architecture/approach",
  "rawContent": "same as explanation"
}`;
  }

  // prose
  return `
OUTPUT FORMAT: Prose. Write 200-500 words of specific, concrete analysis.
No generic filler sentences. Every sentence must directly address the task.
Do NOT describe your methodology — produce the actual output.
Do NOT return JSON for prose tasks.`;
}

function buildLeadSchema(minItems: number): string {
  return `
OUTPUT FORMAT: Return ONLY a valid JSON object with a "leads" array. No markdown fences.
Required structure:
{
  "leads": [
    {
      "name": "Full realistic name appropriate for the target market (ABSOLUTELY NO 'John Doe', 'Jane Doe', or placeholder names)",
      "company": "Real or realistic company name (ABSOLUTELY NO 'Acme Corp', 'Example Ltd', or generic placeholders)",
      "role": "Specific job title (e.g., Sales Director, Operations Head, Co-founder)",
      "location": "Specific city and neighborhood if known (e.g., Dwarka, New Delhi)",
      "niche": "Specific market segment (e.g., NRI investment properties, commercial leasing)",
      "painPoint": "Concrete business problem they face — minimum 15 words, specific to their market",
      "outreachHook": "One sentence connecting their pain to a solution you offer",
      "linkedInSearch": "Search string: '\"[role]\" \"[niche]\" site:linkedin.com'",
      "dataSource": "estimated"
    }
  ],
  "rawContent": "Brief summary: X leads generated in [niche] targeting [location]"
}
Generate EXACTLY ${minItems} leads minimum.
Every lead must be unique — different names, roles, and specific pain points.
dataSource MUST always be "estimated" — never claim these are real contacts.
DO NOT use: John Doe, Jane Doe, Acme, Example, Test, Placeholder, [brackets], or generic English names for Indian markets.`;
}
