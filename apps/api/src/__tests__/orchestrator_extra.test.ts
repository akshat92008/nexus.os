import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cancelDurableMission } from '../orchestrator.js';
import { tasksQueue } from '../queue/queue.js';
import { eventBus } from '../events/eventBus.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';

vi.mock('../storage/nexusStateStore.js', () => ({
  nexusStateStore: {
    updateMissionStatus: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../queue/queue.js', () => ({
  missionsQueue: { getJobs: vi.fn(), remove: vi.fn() },
  tasksQueue: { getJobs: vi.fn(), remove: vi.fn() },
}));

vi.mock('../events/eventBus.js', () => ({
  eventBus: {
    publish: vi.fn().mockResolvedValue({}),
  },
}));

describe('Orchestrator Extra', () => {
  const missionId = 'mission-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels a durable mission by updating status and draining queue', async () => {
    const mockJobs = [
      { data: { missionId }, remove: vi.fn().mockResolvedValue({}) },
      { data: { missionId: 'other' }, remove: vi.fn().mockResolvedValue({}) },
    ];
    (tasksQueue.getJobs as any).mockResolvedValue(mockJobs);

    await cancelDurableMission(missionId);

    expect(nexusStateStore.updateMissionStatus).toHaveBeenCalledWith(missionId, 'cancelled');
    expect(mockJobs[0].remove).toHaveBeenCalled();
    expect(mockJobs[1].remove).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(missionId, expect.objectContaining({
      type: 'mission_cancelled',
    }));
  });
});
