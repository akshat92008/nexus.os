/**
 * Nexus OS — Cron/Task Scheduling System
 * Autonomous operation scheduling inspired by OpenClaw
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { systemQueue } from '../queue/queue.js';
import { randomUUID } from 'crypto';

export type CronSchedule = string; // Cron expression
export type TaskStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type TaskType = 'mission' | 'workflow' | 'agent_request' | 'skill_execution' | 'notification' | 'cleanup';

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  schedule: {
    cron?: CronSchedule;
    interval?: number; // milliseconds
    runOnce?: boolean;
    startAt?: Date;
    endAt?: Date;
    timezone?: string;
  };
  payload: {
    action: string;
    params: Record<string, any>;
    agentId?: string;
    skillId?: string;
    workflowId?: string;
  };
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  maxRuns?: number;
  errorCount: number;
  lastError?: string;
  workspaceId?: string;
  ownerId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: TaskStatus;
  startedAt: Date;
  completedAt?: Date;
  output?: string;
  error?: string;
  logs: string[];
  metadata?: Record<string, any>;
}

export interface CronConfig {
  defaultTimezone: string;
  maxConcurrentTasks: number;
  retryAttempts: number;
  retryDelay: number;
  taskTimeout: number;
}

class CronManager {
  private tasks: Map<string, ScheduledTask> = new Map();
  private runningExecutions: Map<string, NodeJS.Timeout> = new Map();
  private config: CronConfig;
  private checkInterval?: NodeJS.Timeout;

  constructor() {
    this.config = {
      defaultTimezone: process.env.NEXUS_TIMEZONE || 'UTC',
      maxConcurrentTasks: parseInt(process.env.NEXUS_MAX_CONCURRENT_TASKS || '5'),
      retryAttempts: 3,
      retryDelay: 60000, // 1 minute
      taskTimeout: 300000 // 5 minutes
    };
  }

  async initialize() {
    logger.info('[CronManager] Initializing task scheduler...');

    // Load tasks from database
    await this.loadTasks();

    // Start scheduler loop
    this.checkInterval = setInterval(() => {
      this.checkAndExecute().catch(err => {
        logger.error({ err }, '[CronManager] Scheduler loop error');
      });
    }, 30000); // Check every 30 seconds

    logger.info(`[CronManager] Loaded ${this.tasks.size} tasks`);
  }

  async loadTasks() {
    const supabase = await getSupabase();
    const { data: tasks, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .in('status', ['scheduled', 'paused']);

    if (error) {
      logger.error({ err: error }, '[CronManager] Failed to load tasks');
      return;
    }

    for (const data of tasks || []) {
      const task = this.deserializeTask(data);
      this.tasks.set(task.id, task);
      
      // Calculate next run
      if (task.status === 'scheduled') {
        task.nextRunAt = this.calculateNextRun(task);
      }
    }
  }

  async schedule(taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'runCount' | 'errorCount'>): Promise<ScheduledTask> {
    const id = randomUUID();
    const now = new Date();

    const task: ScheduledTask = {
      ...taskData,
      id,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      errorCount: 0,
      nextRunAt: this.calculateNextRun({
        ...taskData,
        id,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
        runCount: 0,
        errorCount: 0
      } as ScheduledTask)
    };

    // Validate schedule
    if (!task.schedule.cron && !task.schedule.interval && !task.schedule.runOnce) {
      throw new Error('Task must have a cron expression, interval, or be runOnce');
    }

    this.tasks.set(id, task);

    // Store in database
    const supabase = await getSupabase();
    await supabase.from('scheduled_tasks').insert({
      id: task.id,
      name: task.name,
      description: task.description,
      type: task.type,
      schedule: task.schedule,
      payload: task.payload,
      status: task.status,
      next_run_at: task.nextRunAt?.toISOString(),
      created_at: task.createdAt.toISOString(),
      updated_at: task.updatedAt.toISOString(),
      workspace_id: task.workspaceId,
      owner_id: task.ownerId,
      tags: task.tags,
      metadata: task.metadata,
      max_runs: task.maxRuns
    });

    logger.info(`[CronManager] Scheduled task: ${task.name} (${id})`);

    // If runOnce and startAt is now or past, execute immediately
    if (task.schedule.runOnce && (!task.schedule.startAt || task.schedule.startAt <= now)) {
      this.executeTask(task).catch(err => {
        logger.error({ err, taskId: id }, '[CronManager] Immediate execution failed');
      });
    }

    return task;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Cancel running execution
    const timeout = this.runningExecutions.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.runningExecutions.delete(taskId);
    }

    task.status = 'cancelled';
    task.updatedAt = new Date();

    const supabase = await getSupabase();
    await supabase
      .from('scheduled_tasks')
      .update({ status: 'cancelled', updated_at: task.updatedAt.toISOString() })
      .eq('id', taskId);

    this.tasks.delete(taskId);

    logger.info(`[CronManager] Cancelled task: ${task.name} (${taskId})`);
    return true;
  }

  async pauseTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'paused';
    task.updatedAt = new Date();

    const supabase = await getSupabase();
    await supabase
      .from('scheduled_tasks')
      .update({ status: 'paused', updated_at: task.updatedAt.toISOString() })
      .eq('id', taskId);

    logger.info(`[CronManager] Paused task: ${task.name} (${taskId})`);
    return true;
  }

  async resumeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'scheduled';
    task.updatedAt = new Date();
    task.nextRunAt = this.calculateNextRun(task);

    const supabase = await getSupabase();
    await supabase
      .from('scheduled_tasks')
      .update({
        status: 'scheduled',
        next_run_at: task.nextRunAt?.toISOString(),
        updated_at: task.updatedAt.toISOString()
      })
      .eq('id', taskId);

    logger.info(`[CronManager] Resumed task: ${task.name} (${taskId})`);
    return true;
  }

  async executeTask(task: ScheduledTask): Promise<TaskExecution> {
    const executionId = randomUUID();
    const execution: TaskExecution = {
      id: executionId,
      taskId: task.id,
      status: 'running',
      startedAt: new Date(),
      logs: []
    };

    // Store execution record
    const supabase = await getSupabase();
    await supabase.from('task_executions').insert({
      id: execution.id,
      task_id: task.id,
      status: execution.status,
      started_at: execution.startedAt.toISOString()
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      this.failExecution(execution, 'Task execution timeout');
    }, this.config.taskTimeout);

    this.runningExecutions.set(task.id, timeoutId);

    try {
      logger.info(`[CronManager] Executing task: ${task.name} (${task.id})`);

      // Execute based on type
      switch (task.type) {
        case 'mission':
          await this.executeMission(task, execution);
          break;
        case 'workflow':
          await this.executeWorkflow(task, execution);
          break;
        case 'agent_request':
          await this.executeAgentRequest(task, execution);
          break;
        case 'skill_execution':
          await this.executeSkill(task, execution);
          break;
        case 'notification':
          await this.executeNotification(task, execution);
          break;
        case 'cleanup':
          await this.executeCleanup(task, execution);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Success
      clearTimeout(timeoutId);
      this.runningExecutions.delete(task.id);

      execution.status = 'completed';
      execution.completedAt = new Date();

      // Update task
      task.runCount++;
      task.lastRunAt = new Date();
      task.errorCount = 0;
      task.lastError = undefined;

      if (task.schedule.runOnce || (task.maxRuns && task.runCount >= task.maxRuns)) {
        task.status = 'completed';
        this.tasks.delete(task.id);
      } else {
        task.nextRunAt = this.calculateNextRun(task);
      }

    } catch (err) {
      clearTimeout(timeoutId);
      this.runningExecutions.delete(task.id);

      task.errorCount++;
      task.lastError = (err as Error).message;
      execution.error = (err as Error).message;

      execution.logs.push(`ERROR: ${(err as Error).message}`);

      // Retry logic
      if (task.errorCount < this.config.retryAttempts) {
        task.status = 'scheduled';
        task.nextRunAt = new Date(Date.now() + this.config.retryDelay * task.errorCount);
        execution.status = 'failed';
      } else {
        task.status = 'failed';
        execution.status = 'failed';
      }
    }

    execution.completedAt = new Date();

    // Update records
    await supabase
      .from('task_executions')
      .update({
        status: execution.status,
        completed_at: execution.completedAt.toISOString(),
        output: execution.output,
        error: execution.error,
        logs: execution.logs
      })
      .eq('id', execution.id);

    await supabase
      .from('scheduled_tasks')
      .update({
        status: task.status,
        run_count: task.runCount,
        error_count: task.errorCount,
        last_error: task.lastError,
        last_run_at: task.lastRunAt?.toISOString(),
        next_run_at: task.nextRunAt?.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    // Publish event
    await eventBus.publish('task_executed', {
      type: 'task_executed',
      taskId: task.id,
      executionId: execution.id,
      status: execution.status,
      timestamp: Date.now()
    });

    logger.info(`[CronManager] Task ${task.name} completed: ${execution.status}`);

    return execution;
  }

  private async executeMission(task: ScheduledTask, execution: TaskExecution) {
    const { planMission } = await import('../missionPlanner.js');
    const { orchestrateDAG } = await import('../orchestrator.js');

    const plan = await planMission(task.payload.params.goal, {
      autoExecute: true,
      workspaceId: task.workspaceId
    });

    execution.output = `Mission planned: ${plan.id}`;
    execution.logs.push(`Planned mission with ${plan.tasks?.length || 0} tasks`);
  }

  private async executeWorkflow(task: ScheduledTask, execution: TaskExecution) {
    const { systemQueue } = await import('../queue/queue.js');
    
    await systemQueue.add(`scheduled_workflow_${task.id}`, {
      type: 'workflow',
      workflowId: task.payload.workflowId,
      params: task.payload.params
    });

    execution.output = `Workflow queued: ${task.payload.workflowId}`;
    execution.logs.push('Workflow added to system queue');
  }

  private async executeAgentRequest(task: ScheduledTask, execution: TaskExecution) {
    await eventBus.publish('agent_request', {
      type: 'agent_request',
      source: 'cron',
      taskId: task.id,
      content: task.payload.params.message,
      agentId: task.payload.agentId,
      timestamp: Date.now()
    });

    execution.output = 'Agent request published';
    execution.logs.push('Published agent request to event bus');
  }

  private async executeSkill(task: ScheduledTask, execution: TaskExecution) {
    const { skillManager } = await import('../skills/skillManager.js');
    
    const result = await skillManager.executeTool(
      task.payload.params.toolName,
      task.payload.params.toolParams,
      { taskId: task.id }
    );

    execution.output = JSON.stringify(result);
    execution.logs.push('Skill executed successfully');
  }

  private async executeNotification(task: ScheduledTask, execution: TaskExecution) {
    const { channelManager } = await import('../channels/channelManager.js');
    
    await channelManager.broadcastMessage(task.payload.params.message, {
      workspaceId: task.workspaceId
    });

    execution.output = 'Notifications sent';
    execution.logs.push('Broadcasted notification to channels');
  }

  private async executeCleanup(task: ScheduledTask, execution: TaskExecution) {
    const { semanticMemory } = await import('../memory/semanticMemory.js');
    
    await semanticMemory.compact({
      before: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      types: ['conversation']
    });

    execution.output = 'Memory compacted';
    execution.logs.push('Cleaned up old conversation memories');
  }

  private async failExecution(execution: TaskExecution, reason: string) {
    execution.status = 'failed';
    execution.error = reason;
    execution.completedAt = new Date();

    const supabase = await getSupabase();
    await supabase
      .from('task_executions')
      .update({
        status: 'failed',
        error: reason,
        completed_at: execution.completedAt.toISOString()
      })
      .eq('id', execution.id);
  }

  private async checkAndExecute() {
    const now = new Date();

    for (const [_, task] of this.tasks) {
      if (task.status !== 'scheduled') continue;
      if (task.nextRunAt && task.nextRunAt > now) continue;
      if (task.schedule.endAt && task.schedule.endAt < now) {
        task.status = 'completed';
        continue;
      }

      // Check concurrent limits
      if (this.runningExecutions.size >= this.config.maxConcurrentTasks) {
        logger.warn('[CronManager] Max concurrent tasks reached, deferring');
        continue;
      }

      // Execute
      this.executeTask(task).catch(err => {
        logger.error({ err, taskId: task.id }, '[CronManager] Task execution error');
      });
    }
  }

  private calculateNextRun(task: ScheduledTask): Date | undefined {
    const now = new Date();

    if (task.schedule.runOnce) {
      return undefined;
    }

    if (task.schedule.interval) {
      const base = task.lastRunAt || task.createdAt;
      return new Date(base.getTime() + task.schedule.interval);
    }

    if (task.schedule.cron) {
      // Simple cron parsing for common patterns
      return this.parseCron(task.schedule.cron, now);
    }

    return undefined;
  }

  private parseCron(cron: string, from: Date): Date {
    // Basic cron support - use a library in production
    // For now, handle simple patterns
    const parts = cron.split(' ');
    const next = new Date(from);
    
    if (parts.length >= 5) {
      // minute hour day month dow
      if (parts[0].includes('*')) {
        next.setMinutes(next.getMinutes() + 1);
      } else {
        next.setMinutes(parseInt(parts[0]));
      }
    }

    return next;
  }

  async getTasks(filter?: { 
    status?: TaskStatus;
    type?: TaskType;
    workspaceId?: string;
    tags?: string[];
  }): Promise<ScheduledTask[]> {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }
    if (filter?.type) {
      tasks = tasks.filter(t => t.type === filter.type);
    }
    if (filter?.workspaceId) {
      tasks = tasks.filter(t => t.workspaceId === filter.workspaceId);
    }
    if (filter?.tags) {
      tasks = tasks.filter(t => filter.tags!.some(tag => t.tags?.includes(tag)));
    }

    return tasks;
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  getRunningTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(t => t.status === 'running');
  }

  private deserializeTask(data: any): ScheduledTask {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      schedule: data.schedule,
      payload: data.payload,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastRunAt: data.last_run_at ? new Date(data.last_run_at) : undefined,
      nextRunAt: data.next_run_at ? new Date(data.next_run_at) : undefined,
      runCount: data.run_count || 0,
      maxRuns: data.max_runs,
      errorCount: data.error_count || 0,
      lastError: data.last_error,
      workspaceId: data.workspace_id,
      ownerId: data.owner_id,
      tags: data.tags,
      metadata: data.metadata
    };
  }
}

export const cronManager = new CronManager();
