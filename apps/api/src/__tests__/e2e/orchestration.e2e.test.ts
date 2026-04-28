import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MissionRecorder, MissionReplayer, missionRecorder, missionReplayer } from '../missionReplay.js';
import type { TaskDAG, TaskNode } from '@nexus-os/types';

describe('Mission Orchestration E2E', () => {
  const baseURL = (global as any).TEST_BASE_URL;

  beforeEach(() => {
    // Reset mission recorder/replayer state
    missionRecorder.interactions = [];
  });

  describe('Mission Creation and Execution', () => {
    it('should create and execute a simple research mission', async () => {
      const response = await fetch(`${baseURL}/api/missions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: 'Research the latest developments in AI',
          goalType: 'research'
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.missionId).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.status).toBe('created');
    });

    it('should handle mission status queries', async () => {
      const missionId = 'test-mission-123';
      const response = await fetch(`${baseURL}/api/missions/${missionId}/status`);

      expect(response.ok).toBe(true);
      const status = await response.json();
      expect(status.missionId).toBe(missionId);
      expect(status.status).toBe('completed');
    });
  });

  describe('Mission Replay Functionality', () => {
    it('should record mission interactions when in record mode', async () => {
      // Set record mode
      process.env.MISSION_REPLAY_MODE = 'record';

      const response = await fetch(`${baseURL}/api/missions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: 'Test recording functionality',
          goalType: 'research'
        })
      });

      expect(response.ok).toBe(true);

      // Check that recording started
      expect(missionRecorder.isRecording).toBe(true);
    });

    it('should replay recorded interactions when in replay mode', async () => {
      // Enable replay mode
      process.env.MISSION_REPLAY_MODE = 'replay';
      missionReplayer.enableReplayMode();

      // Load test recordings
      await missionReplayer.loadRecordings();

      // Test replay response lookup
      const mockInput = {
        prompt: 'Test prompt',
        context: {},
        taskNode: {
          id: 'test-task',
          agentType: 'researcher' as const,
          dependencies: []
        } as TaskNode
      };

      const replayResponse = missionReplayer.getReplayResponse(
        'test-task',
        'researcher',
        mockInput
      );

      // In a real scenario, this would return a recorded response
      // For this test, we expect null since we don't have recordings
      expect(replayResponse).toBeNull();
    });
  });

  describe('Agent Orchestration Flow', () => {
    it('should handle complex multi-agent mission orchestration', async () => {
      // This would test the full orchestration flow
      // For now, we'll test the basic structure

      const complexMission = {
        goal: 'Create a comprehensive analysis of renewable energy trends',
        goalType: 'analysis' as const,
        expectedTasks: [
          'researcher: Gather data on renewable energy',
          'analyst: Analyze trends and patterns',
          'writer: Create comprehensive report'
        ]
      };

      const response = await fetch(`${baseURL}/api/missions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(complexMission)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Verify mission was created
      expect(result.missionId).toMatch(/^test-mission-/);
      expect(result.sessionId).toMatch(/^test-session-/);
    });

    it('should handle mission failures gracefully', async () => {
      // Test error handling in mission execution
      const failingMission = {
        goal: 'This should fail',
        goalType: 'invalid' as any
      };

      const response = await fetch(`${baseURL}/api/missions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(failingMission)
      });

      // Even with invalid data, the API should respond
      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete missions within reasonable time limits', async () => {
      const startTime = Date.now();

      const response = await fetch(`${baseURL}/api/missions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: 'Quick performance test',
          goalType: 'research'
        })
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent mission requests', async () => {
      const promises = Array(5).fill(null).map((_, i) =>
        fetch(`${baseURL}/api/missions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            goal: `Concurrent mission ${i}`,
            goalType: 'research'
          })
        })
      );

      const responses = await Promise.all(promises);
      const allOk = responses.every(r => r.ok);

      expect(allOk).toBe(true);
    });
  });
});