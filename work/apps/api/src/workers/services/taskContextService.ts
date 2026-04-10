import { nexusStateStore } from '../../storage/nexusStateStore.js';
import type { AgentContext, MemoryEntry } from '@nexus-os/types';

/**
 * Service for building the execution context for an agent.
 * Fetches dependencies from the database and formats them for the prompt.
 */
export async function buildTaskContext(missionId: string, contextFields: string[]): Promise<AgentContext> {
  const context: AgentContext = {
    entries: [],
    promptBlock: '',
    permissions: {
      fileAccess: false,
      networkAccess: true,
      exec: 'limited'
    }
  };

  if (contextFields && contextFields.length > 0) {
    const artifacts = await nexusStateStore.fetchArtifactsByContext(missionId, contextFields);
    
    context.entries = artifacts.map((a: any) => ({
      key: `artifact:${a.task_id}`,
      taskId: a.task_id,
      agentType: a.type,
      data: a.content,
      writtenAt: new Date(a.created_at).getTime(),
      tokensUsed: 0
    } as MemoryEntry));

    context.promptBlock = artifacts.map((a: any) => 
      `--- Context from Task: ${a.task_id} ---\n${JSON.stringify(a.content, null, 2)}`
    ).join('\n\n');
  }

  return context;
}
