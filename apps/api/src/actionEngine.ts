import type { Workspace, NextAction, WorkspaceTask } from '@nexus-os/types';

export function generateNextActions(workspace: Workspace): NextAction[] {
  const actions: NextAction[] = [];
  let actionIdCounter = 1;

  for (const section of workspace.sections) {
    if (section.type === 'tasklist') {
      const tasks = section.content as WorkspaceTask[];
      const pendingHigh = tasks.filter(t => t.status !== 'done' && t.priority === 'high');
      const pendingOther = tasks.filter(t => t.status !== 'done' && t.priority !== 'high');

      pendingHigh.forEach(task => {
        actions.push({
          id: `act_${workspace.id}_${actionIdCounter++}`,
          title: `Execute: ${task.title}`,
          description: 'High priority task identified in your strategy roadmap.',
          priority: 'high',
          type: 'execute',
          relatedSectionId: section.id,
        });
      });

      if (pendingOther.length > 0) {
        actions.push({
          id: `act_${workspace.id}_${actionIdCounter++}`,
          title: `Complete ${pendingOther.length} pending task(s)`,
          description: 'Additional items remain in your strategic timeline.',
          priority: 'medium',
          type: 'execute',
          relatedSectionId: section.id,
        });
      }
    }

    if (section.type === 'table') {
      const rows = section.content as any[];
      if (rows.length > 0) {
        actions.push({
          id: `act_${workspace.id}_${actionIdCounter++}`,
          title: `Follow up with ${rows.length} leads`,
          description: 'Initiate contact using the generated outreach templates.',
          priority: 'high',
          type: 'follow-up',
          relatedSectionId: section.id,
        });
      }
    }

    if (section.type === 'insight') {
      actions.push({
        id: `act_${workspace.id}_${actionIdCounter++}`,
        title: `Review Executive Insights`,
        description: 'Analyze synthesized findings to shape your next strategic move.',
        priority: 'low',
        type: 'review',
        relatedSectionId: section.id,
      });
    }
  }

  // Sort: High -> Medium -> Low
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  actions.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

  // Cap to top 5 actions to keep it actionable
  return actions.slice(0, 5);
}

/**
 * OS Hook: Pre-integration for sandboxed code execution.
 * Detects if the artifact content contains executable blocks (JS/TS/Python).
 */
export function detectExecutableCode(artifact: any): boolean {
  if (!artifact || typeof artifact.content !== 'string') return false;
  
  const codeRegex = /```(javascript|typescript|python|bash|sh|node)\s*[\s\S]*?```/gi;
  return codeRegex.test(artifact.content);
}

/**
 * OS Hook: Placeholder for future sandboxed execution.
 * This is the Layer 4 primitive that will be used by the MCP/Sandbox layer.
 */
export async function executeCodePlaceholder(code: string, language: string): Promise<any> {
  console.log(`[ActionEngine] ⚡ Placeholder for ${language.toUpperCase()} execution:`, code.slice(0, 50) + '...');
  
  // For now, this just logs and returns a mock result
  return {
    status: 'pending_sandbox_implementation',
    message: 'Code execution primitive ready for Sandbox integration.',
    codeLength: code.length,
    language
  };
}
