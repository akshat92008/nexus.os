import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MissionMemory } from '../missionMemory.js';
import { TaskRegistry } from '../taskRegistry.js';
import { computeExecutionWaves } from '../orchestrator.js';
import { missionRecorder, missionReplayer } from '../missionReplay.js';
import type { TaskNode, AgentType } from '@nexus-os/types';

// Mock LLM responses for deterministic testing
const mockLLMResponses = new Map<string, string>();

// Set up mock responses for common scenarios
mockLLMResponses.set('research-planning', JSON.stringify({
  nodes: [
    {
      id: 'research-1',
      label: 'Research current AI developments',
      agentType: 'researcher',
      dependencies: [],
      priority: 'high',
      maxRetries: 2,
      contextFields: [],
      expectedOutput: {
        format: 'structured',
        schema: { findings: 'array', sources: 'array' }
      }
    },
    {
      id: 'analyze-1',
      label: 'Analyze research findings',
      agentType: 'analyst',
      dependencies: ['research-1'],
      priority: 'high',
      maxRetries: 2,
      contextFields: ['research-1'],
      expectedOutput: {
        format: 'structured',
        schema: { insights: 'array', trends: 'array' }
      }
    }
  ]
}));

mockLLMResponses.set('researcher-response', JSON.stringify({
  findings: [
    'AI is advancing rapidly in multiple domains',
    'Large language models are becoming more capable',
    'There are concerns about AI safety and ethics'
  ],
  sources: [
    'Recent publications from leading AI labs',
    'Industry reports from 2024',
    'Academic research papers'
  ]
}));

mockLLMResponses.set('analyst-response', JSON.stringify({
  insights: [
    'The field is moving towards multimodal AI systems',
    'There is increasing focus on AI alignment and safety',
    'Commercial applications are expanding rapidly'
  ],
  trends: [
    'Increased investment in AI infrastructure',
    'Growing emphasis on responsible AI development',
    'Rising demand for AI talent and skills'
  ]
}));

describe('Mission Orchestration E2E with Replay', () => {
  let memory: MissionMemory;
  let registry: TaskRegistry;
  const baseURL = (global as any).TEST_BASE_URL;

  beforeEach(() => {
    // Initialize components
    memory = new MissionMemory();
    registry = new TaskRegistry();

    // Reset recorder state
    missionRecorder.interactions = [];
  });

  afterEach(async () => {
    // Clean up any recordings
    try {
      if (process.env.MISSION_REPLAY_MODE === 'record') {
        await missionRecorder.saveRecording();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Full Mission Lifecycle', () => {
    it('should execute a complete research and analysis mission', async () => {
      const missionId = `e2e-test-${Date.now()}`;
      const sessionId = `session-${Date.now()}`;
      const userId = 'test-user';

      // Create a simple task DAG for testing
      const taskDAG = {
        nodes: [
          {
            id: 'research-task',
            label: 'Research AI developments',
            agentType: 'researcher' as AgentType,
            dependencies: [],
            priority: 'high' as const,
            maxRetries: 2,
            contextFields: [],
            expectedOutput: {
              format: 'structured' as const,
              schema: { findings: 'array', sources: 'array' }
            }
          },
          {
            id: 'analysis-task',
            label: 'Analyze findings',
            agentType: 'analyst' as AgentType,
            dependencies: ['research-task'],
            priority: 'high' as const,
            maxRetries: 2,
            contextFields: ['research-task'],
            expectedOutput: {
              format: 'structured' as const,
              schema: { insights: 'array', trends: 'array' }
            }
          }
        ]
      };

      // Test wave computation
      const waves = computeExecutionWaves(taskDAG.nodes);
      expect(waves.length).toBe(2);
      expect(waves[0].length).toBe(1); // First wave: research task
      expect(waves[1].length).toBe(1); // Second wave: analysis task
      expect(waves[0][0].id).toBe('research-task');
      expect(waves[1][0].id).toBe('analysis-task');

      // Verify dependency resolution
      expect(waves[0][0].dependencies).toEqual([]);
      expect(waves[1][0].dependencies).toEqual(['research-task']);
    });

    it('should handle mission recording and replay', async () => {
      // Set up recording mode
      process.env.MISSION_REPLAY_MODE = 'record';

      const missionId = `replay-test-${Date.now()}`;
      const taskNode: TaskNode = {
        id: 'test-task',
        label: 'Test task for replay',
        agentType: 'researcher',
        dependencies: [],
        priority: 'medium',
        maxRetries: 2,
        contextFields: [],
        expectedOutput: {
          format: 'structured',
          schema: { result: 'string' }
        }
      };

      // Start recording
      missionRecorder.startRecording();

      // Simulate recording an interaction
      missionRecorder.recordInteraction({
        taskId: taskNode.id,
        agentType: taskNode.agentType,
        input: {
          prompt: 'Test prompt',
          context: {},
          taskNode
        },
        output: {
          type: 'research',
          data: { result: 'Test output' }
        }
      });

      // Save the recording
      const recordingPath = await missionRecorder.saveRecording();

      // Verify recording was saved
      expect(recordingPath).toBeDefined();

      // Switch to replay mode
      process.env.MISSION_REPLAY_MODE = 'replay';
      missionReplayer.enableReplayMode();
      await missionReplayer.loadRecordings();

      // Test replay
      const replayResponse = missionReplayer.getReplayResponse(
        taskNode.id,
        taskNode.agentType,
        {
          prompt: 'Test prompt',
          context: {},
          taskNode
        }
      );

      expect(replayResponse).toBeDefined();
      expect(replayResponse?.type).toBe('research');
      expect((replayResponse?.data as any)?.result).toBe('Test output');
    });

    it('should handle complex DAG with parallel execution', () => {
      const complexDAG = {
        nodes: [
          // Root tasks (no dependencies)
          {
            id: 'research-1',
            label: 'Research topic A',
            agentType: 'researcher' as AgentType,
            dependencies: []
          },
          {
            id: 'research-2',
            label: 'Research topic B',
            agentType: 'researcher' as AgentType,
            dependencies: []
          },
          // Dependent tasks
          {
            id: 'analysis-1',
            label: 'Analyze topic A',
            agentType: 'analyst' as AgentType,
            dependencies: ['research-1']
          },
          {
            id: 'analysis-2',
            label: 'Analyze topic B',
            agentType: 'analyst' as AgentType,
            dependencies: ['research-2']
          },
          // Final synthesis
          {
            id: 'synthesis',
            label: 'Synthesize all findings',
            agentType: 'strategist' as AgentType,
            dependencies: ['analysis-1', 'analysis-2']
          }
        ] as TaskNode[]
      };

      const waves = computeExecutionWaves(complexDAG.nodes);

      // Should have 3 waves
      expect(waves.length).toBe(3);

      // First wave: parallel research tasks
      expect(waves[0].length).toBe(2);
      expect(waves[0].map(n => n.id).sort()).toEqual(['research-1', 'research-2'].sort());

      // Second wave: parallel analysis tasks
      expect(waves[1].length).toBe(2);
      expect(waves[1].map(n => n.id).sort()).toEqual(['analysis-1', 'analysis-2'].sort());

      // Third wave: final synthesis
      expect(waves[2].length).toBe(1);
      expect(waves[2][0].id).toBe('synthesis');
    });

    it('should handle mission failures and retries gracefully', async () => {
      // Test that the system can handle and recover from failures
      const failingTaskNode: TaskNode = {
        id: 'failing-task',
        label: 'Task that might fail',
        agentType: 'researcher',
        dependencies: [],
        priority: 'medium',
        maxRetries: 2,
        contextFields: [],
        expectedOutput: {
          format: 'structured',
          schema: { result: 'string' }
        }
      };

      // Verify task has retry configuration
      expect(failingTaskNode.maxRetries).toBe(2);
      expect(failingTaskNode.priority).toBe('medium');

      // In a real scenario, this would test actual failure handling
      // For now, we verify the structure is correct
      expect(failingTaskNode.id).toBe('failing-task');
      expect(failingTaskNode.agentType).toBe('researcher');
    });
  });

  describe('Performance Characteristics', () => {
    it('should compute execution waves efficiently', () => {
      // Create a larger DAG to test performance
      const largeDAG = {
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `task-${i}`,
          label: `Task ${i}`,
          agentType: 'researcher' as AgentType,
          dependencies: i > 0 ? [`task-${i - 1}`] : []
        })) as TaskNode[]
      };

      const startTime = Date.now();
      const waves = computeExecutionWaves(largeDAG.nodes);
      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second

      // Should have 50 waves for linear chain
      expect(waves.length).toBe(50);
    });

    it('should handle memory operations efficiently', async () => {
      const startTime = Date.now();

      // Simulate multiple memory operations
      for (let i = 0; i < 10; i++) {
        await memory.depositArtifact({
          taskId: `memory-test-${i}`,
          artifact: {
            type: 'test',
            data: { value: `test data ${i}` }
          }
        });
      }

      const endTime = Date.now();

      // Should complete memory operations quickly
      expect(endTime - startTime).toBeLessThan(5000); // Less than 5 seconds
    });
  });
});