/**
 * Nexus OS — Mission Planner Utilities
 *
 * Helper functions for DAG validation, deduplication, and cycle detection.
 */

import { TaskNode } from '@nexus-os/types';

const SIMILARITY_THRESHOLD = 0.55;

export function ngramSimilarity(a: string, b: string, n = 3): number {
  const ngrams = (s: string): Set<string> => {
    const set = new Set<string>();
    const lower = s.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    for (let i = 0; i < lower.length - n + 1; i++) {
      set.add(lower.slice(i, i + n));
    }
    return set;
  };
  const setA = ngrams(a);
  const setB = ngrams(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function deduplicateAndScore(nodes: TaskNode[], goal: string): TaskNode[] {
  const unique: TaskNode[] = [];
  for (const candidate of nodes) {
    const isDuplicate = unique.some(
      (existing) => ngramSimilarity(candidate.label, existing.label) > SIMILARITY_THRESHOLD
    );
    if (isDuplicate) continue;
    candidate.goalAlignment = ngramSimilarity(candidate.label, goal);
    if (candidate.goalAlignment < 0.07 && candidate.priority === 'low') continue;
    unique.push(candidate);
  }
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return unique.sort((a, b) => {
    const po = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    if (po !== 0) return po;
    return (b.goalAlignment ?? 0) - (a.goalAlignment ?? 0);
  });
}

export function detectCycles(nodes: TaskNode[]): string | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;
    inStack.add(id);
    const node = nodeMap.get(id);
    if (node) {
      for (const dep of node.dependencies) {
        if (dfs(dep)) return true;
      }
    }
    inStack.delete(id);
    visited.add(id);
    return false;
  }

  for (const node of nodes) {
    if (dfs(node.id)) return node.id;
  }
  return null;
}

export function extractJSON(raw: string): unknown {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) throw new Error('No JSON block found');
    return JSON.parse(match[0]);
  }
}
