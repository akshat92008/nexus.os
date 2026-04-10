import { describe, it, expect } from 'vitest';
import { computeExecutionWaves } from '../orchestrator.js';
import type { TaskNode } from '@nexus-os/types';

describe('Orchestrator — computeExecutionWaves (Deeper Tests)', () => {
  it('linear chain A→B→C produces 3 waves', () => {
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

  it('parallel nodes with no deps produce 1 wave', () => {
    const nodes: TaskNode[] = [
      { id: 'A', label: 'Task A', agentType: 'researcher', dependencies: [] } as any,
      { id: 'B', label: 'Task B', agentType: 'researcher', dependencies: [] } as any,
      { id: 'C', label: 'Task C', agentType: 'researcher', dependencies: [] } as any,
    ];

    const waves = computeExecutionWaves(nodes);

    expect(waves.length).toBe(1);
    expect(waves[0].map(n => n.id).sort()).toEqual(['A', 'B', 'C'].sort());
  });

  it('circular dependency falls back to terminal wave (not infinite loop)', () => {
    const nodes: TaskNode[] = [
      { id: 'A', label: 'Task A', agentType: 'researcher', dependencies: ['B'] } as any,
      { id: 'B', label: 'Task B', agentType: 'researcher', dependencies: ['A'] } as any,
    ];

    // The implementation in orchestrator.ts has a safetyLimit and a bottleneck detection
    // which pushes remaining nodes to a terminal wave.
    const waves = computeExecutionWaves(nodes);

    expect(waves.length).toBe(1);
    expect(waves[0].map(n => n.id).sort()).toEqual(['A', 'B'].sort());
  });

  it('complex DAG with multiple branches', () => {
    const nodes: TaskNode[] = [
      { id: 'A', label: 'Task A', agentType: 'researcher', dependencies: [] } as any,
      { id: 'B1', label: 'Task B1', agentType: 'researcher', dependencies: ['A'] } as any,
      { id: 'B2', label: 'Task B2', agentType: 'researcher', dependencies: ['A'] } as any,
      { id: 'C', label: 'Task C', agentType: 'researcher', dependencies: ['B1', 'B2'] } as any,
      { id: 'D', label: 'Task D', agentType: 'researcher', dependencies: [] } as any,
      { id: 'E', label: 'Task E', agentType: 'researcher', dependencies: ['D', 'C'] } as any,
    ];

    const waves = computeExecutionWaves(nodes);

    // Wave 1: A, D (no deps)
    // Wave 2: B1, B2 (deps: A)
    // Wave 3: C (deps: B1, B2)
    // Wave 4: E (deps: D, C)
    expect(waves.length).toBe(4);
    expect(waves[0].map(n => n.id).sort()).toEqual(['A', 'D'].sort());
    expect(waves[1].map(n => n.id).sort()).toEqual(['B1', 'B2'].sort());
    expect(waves[2].map(n => n.id)).toEqual(['C']);
    expect(waves[3].map(n => n.id)).toEqual(['E']);
  });
});
