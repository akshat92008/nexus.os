import type { TaskNode, AgentType, TaskPriority } from '@nexus-os/types';
import { logger } from '../logger.js';
import { getGlobalGovernor } from '../rateLimitGovernor.js';
import { runChiefAnalyst } from '../chiefAnalyst.js';
import { transformToWorkspace } from '../outputFormatter.js';
import { ledger } from '../ledger.js';
import { MissionMemory } from '../missionMemory.js';
import { TaskRegistry } from '../taskRegistry.js';

export interface DagEngineOptions {
  nodes: TaskNode[];
  userId: string;
  missionId: string;
  goal: string;
  goalType?: string;
  workspaceId?: string;
  onEvent?: (event: any) => void;
}

export class DAGValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DAGValidationError';
  }
}

export class DagEngine {
  private nodes: TaskNode[];
  private userId: string;
  private missionId: string;
  private goal: string;
  private goalType: string;
  private workspaceId?: string;
  private memory: MissionMemory;
  private registry: TaskRegistry;
  private onEvent?: (event: any) => void;

  constructor(opts: DagEngineOptions) {
    this.nodes = opts.nodes;
    this.userId = opts.userId;
    this.missionId = opts.missionId;
    this.goal = opts.goal;
    this.goalType = opts.goalType || 'general';
    this.workspaceId = opts.workspaceId;
    this.onEvent = opts.onEvent;
    
    this.memory = new MissionMemory(this.missionId, this.goal);
    this.registry = new TaskRegistry(this.missionId);
    
    this.nodes.forEach(n => this.registry.initTask(n.id));
  }

  /**
   * Main Execution Entry Point
   */
  async executeGraph(): Promise<any> {
    const startMs = Date.now();
    const waves = this.computeExecutionWaves();
    
    this.emit({
      type: 'plan_ready',
      nodeCount: this.nodes.length,
      waveCount: waves.length,
      goal: this.goal,
    });

    try {
      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i];
        logger.info({ missionId: this.missionId, waveIndex: i + 1 }, `🌊 Executing Wave`);
        
        const results = await Promise.allSettled(
          wave.map(async (task, idx) => {
            if (idx > 0) await new Promise(r => setTimeout(r, idx * 800));
            return this.executeTask(task, i);
          })
        );

        const failedCount = results.filter((r) => r.status === 'rejected').length;
        if (failedCount > 0) {
          throw new Error(`Wave ${i + 1} failed with ${failedCount} task(s) in error.`);
        }

        if (i < waves.length - 1) await new Promise(r => setTimeout(r, 2000));
      }

      // Synthesis Phase
      if (this.memory.size > 0) {
        this.emit({ type: 'agent_working', message: 'Nexus Master Brain synthesizing results...' });
        
        const governor = getGlobalGovernor();
        const allEntries = this.memory.readAll();
        // Synthetic mock for Chief Analyst call
        const synthesis = await runChiefAnalyst({ goal: this.goal, goalType: this.goalType } as any, allEntries, governor);
        
        const workspace = transformToWorkspace(
          synthesis,
          this.goal,
          this.goalType,
          this.missionId,
          new Map(allEntries.map(e => [e.taskId, e.data]))
        );

        this.emit({
          type: 'done',
          message: 'Mission accomplished.',
          workspace,
          durationMs: Date.now() - startMs,
        });

        return workspace;
      }
    } catch (err: any) {
      this.emit({ type: 'error', message: `Execution failed: ${err.message}` });
      throw err;
    }
  }

  private async executeTask(task: TaskNode, waveIndex: number): Promise<void> {
    const governor = getGlobalGovernor();
    
    this.emit({
      type: 'agent_spawn',
      taskId: task.id,
      taskLabel: task.label,
      agentType: task.agentType,
      mode: 'wave',
      waveIndex,
    });

    const context = (this.memory as any).selectiveRead ? (this.memory as any).selectiveRead(task.contextFields) : { entries: [] };
    let attempt = 0;
    const maxRetries = task.maxRetries ?? 2;

    while (attempt <= maxRetries) {
      try {
        const result = await governor.execute(async () => {
          const { runAgent } = await import('../agents/agentRunner.js');
          return await (runAgent as any)({
            task,
            goal: this.goal,
            goalType: this.goalType,
            context,
            missionId: this.missionId,
            userId: this.userId,
            workspaceId: this.workspaceId,
          });
        });

        await this.memory.write(task.id, task.agentType, result.artifact, result.tokensUsed);
        this.registry.markCompleted(task.id, `artifact:${task.id}`);
        
        ledger.recordTransaction(this.userId, task.id, task.label, task.agentType, result.tokensUsed)
          .catch(e => logger.warn({ err: e }, '[DagEngine] Ledger write warning'));
        
        return;
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries) throw err;
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  private computeExecutionWaves(): TaskNode[][] {
    const waves: TaskNode[][] = [];
    const nodeMap = new Map<string, TaskNode>(this.nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const node of this.nodes) {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    }

    for (const node of this.nodes) {
      for (const depId of node.dependencies || []) {
        if (!nodeMap.has(depId)) throw new DAGValidationError(`Task "${node.id}" depends on non-existent "${depId}"`);
        inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
        adj.get(depId)!.push(node.id);
      }
    }

    let queue = this.nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
    let processedCount = 0;

    while (queue.length > 0) {
      const waveIds = [...queue];
      const waveNodes: TaskNode[] = [];
      const nextQueue: string[] = [];

      for (const id of waveIds) {
        waveNodes.push(nodeMap.get(id)!);
        processedCount++;
        for (const neighborId of adj.get(id) || []) {
          const d = (inDegree.get(neighborId) || 0) - 1;
          inDegree.set(neighborId, d);
          if (d === 0) nextQueue.push(neighborId);
        }
      }
      if (waveNodes.length > 0) waves.push(waveNodes);
      queue = nextQueue;
    }

    if (processedCount !== this.nodes.length) throw new DAGValidationError(`Circular dependency detected`);
    return waves;
  }

  private emit(event: any) {
    if (this.onEvent) this.onEvent(event);
  }
}
