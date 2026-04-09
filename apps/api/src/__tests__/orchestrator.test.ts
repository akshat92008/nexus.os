import { describe, it, expect } from 'vitest';
import { computeExecutionWaves } from '../orchestrator.js';
import type { TaskNode } from '@nexus-os/types';

describe('Orchestrator — computeExecutionWaves', () => {
  it('returns empty array for empty node list', () => {
    const result = computeExecutionWaves([]);
    expect(result).toEqual([]);
  });

  it('correctly resolves a linear chain A → B → C', () => {
    const nodes: TaskNode[] = [
      { id: 'A', label: 'Task A', agentType: 'researcher', dependencies: [] } as any,
      { id: 'B', label: 'Task B', agentType: 'researcher', dependencies: ['A'] } as any,
      { id: 'C', label: 'Task C', agentType: 'researcher', dependencies: ['B'] } as any,
    ];

    const waves = computeExecutionWaves(nodes);

    expect(waves.length).toBe(3);
    expect(waves[0].map(n => n.id)).toEqual(['A']);
    expect(waves[1].map(n => n.id)).toEqual(['B']);
    expect(waves[2].map(n => n.id)).toEqual(['C']);
  });

  it('correctly resolves parallel tasks with no dependencies', () => {
    const nodes: TaskNode[] = [
      { id: 'A', label: 'Task A', agentType: 'researcher', dependencies: [] } as any,
      { id: 'B', label: 'Task B', agentType: 'researcher', dependencies: [] } as any,
      { id: 'C', label: 'Task C', agentType: 'researcher', dependencies: [] } as any,
    ];

    const waves = computeExecutionWaves(nodes);

    expect(waves.length).toBe(1);
    expect(waves[0].map(n => n.id).sort()).toEqual(['A', 'B', 'C'].sort());
  });

  it('handles mixed parallel and serial dependencies', () => {
    const nodes: TaskNode[] = [
      { id: 'A', label: 'Task A', agentType: 'researcher', dependencies: [] } as any,
      { id: 'B', label: 'Task B', agentType: 'researcher', dependencies: [] } as any,
      { id: 'C', label: 'Task C', agentType: 'researcher', dependencies: ['A', 'B'] } as any,
      { id: 'D', label: 'Task D', agentType: 'researcher', dependencies: ['C'] } as any,
    ];

    const waves = computeExecutionWaves(nodes);

    expect(waves.length).toBe(3);
    expect(waves[0].map(n => n.id).sort()).toEqual(['A', 'B'].sort());
    expect(waves[1].map(n => n.id)).toEqual(['C']);
    expect(waves[2].map(n => n.id)).toEqual(['D']);
  });

  it('handles unknown dependencies by falling back to terminal wave', () => {
    const nodes: TaskNode[] = [
      { id: 'A', label: 'Task A', agentType: 'researcher', dependencies: [] } as any,
      { id: 'B', label: 'Task B', agentType: 'researcher', dependencies: ['NON_EXISTENT'] } as any,
    ];

    // The current implementation in orchestrator.ts:
    // When a bottleneck is detected, it pushes remaining nodes to a terminal wave.
    const waves = computeExecutionWaves(nodes);

    expect(waves.length).toBe(2);
    expect(waves[0].map(n => n.id)).toEqual(['A']);
    expect(waves[1].map(n => n.id)).toEqual(['B']);
  });
});
