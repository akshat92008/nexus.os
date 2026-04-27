import { randomUUID } from 'crypto';
import { masterBrain } from './core/masterBrain.js';
import { eventBus } from './events/eventBus.js';
import { nexusStateStore } from './storage/nexusStateStore.js';
import { toolExecutor } from './tools/toolExecutor.js';

export { orchestrator } from './core/orchestrator.js';

function parseSimpleFileGoal(goal: string): { path: string; content: string } | null {
  const normalized = goal.trim();
  const match = normalized.match(/create (?:a )?file (?:called )?([^\s]+)\s+with (?:the )?content\s+(.+)/i);
  if (!match) return null;

  return {
    path: match[1].trim(),
    content: match[2].trim(),
  };
}

export async function startDurableMission(params: {
  goal: string;
  goalType?: string;
  userId: string;
  sessionId?: string;
  workspaceId?: string;
  res?: { write: (chunk: string) => void; end?: () => void };
  isAborted: () => boolean;
}) {
  const missionId = params.sessionId || randomUUID();

  await nexusStateStore
    .createMission({
      id: missionId,
      userId: params.userId,
      workspaceId: params.workspaceId,
      goal: params.goal,
      goalType: params.goalType,
    })
    .catch(() => {});

  await eventBus.publish(missionId, {
    type: 'queued',
    missionId,
    goal: params.goal,
  });

  if (params.isAborted()) {
    await nexusStateStore.updateMissionStatus(missionId, 'aborted').catch(() => {});
    await eventBus.publish(missionId, { type: 'error', missionId, message: 'Mission aborted before start' });
    return { missionId, status: 'aborted' };
  }

  await nexusStateStore.updateMissionStatus(missionId, 'running').catch(() => {});
  await eventBus.publish(missionId, { type: 'started', missionId, goal: params.goal });

  try {
    let result: any;
    const simpleFileGoal = parseSimpleFileGoal(params.goal);

    if (simpleFileGoal) {
      result = await toolExecutor.execute({
        id: randomUUID(),
        toolName: 'write_file',
        arguments: simpleFileGoal,
        missionId,
        taskId: 'simple_file_write',
        userId: params.userId,
        workspaceId: params.workspaceId,
      });
    } else {
      result = await masterBrain.processCommand(params.goal, params.userId);
    }

    await nexusStateStore
      .updateMissionStatus(missionId, 'completed', new Date().toISOString())
      .catch(() => {});
    await eventBus.publish(missionId, { type: 'done', missionId, result });
    return { missionId, status: 'completed', result };
  } catch (err: any) {
    await nexusStateStore.updateMissionStatus(missionId, 'failed').catch(() => {});
    await eventBus.publish(missionId, {
      type: 'error',
      missionId,
      message: err.message,
    });
    throw err;
  }
}
