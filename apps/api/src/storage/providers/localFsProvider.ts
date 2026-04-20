import fs from 'fs/promises';
import path from 'path';
import type { PersistenceProvider } from '../persistenceProvider.js';
import type { 
  AgentType, 
  TypedArtifact, 
  ScheduleSnapshot, 
  UserStateSnapshot,
  Workspace
} from '@nexus-os/types';
import { v4 as uuidv4 } from 'uuid';

interface DataStore {
  missions: any[];
  tasks: any[];
  taskDependencies: any[];
  artifacts: any[];
  userState: Record<string, UserStateSnapshot>;
  schedules: any[];
}

export class LocalFSPersistenceProvider implements PersistenceProvider {
  private filePath: string;
  private data: DataStore | null = null;
  private lockPromise: Promise<void> = Promise.resolve();

  constructor(fileName: string = 'nexus-state.json') {
    this.filePath = path.join(process.cwd(), fileName);
  }

  private async _ensureLoaded() {
    if (this.data) return;
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content);
    } catch (e) {
      this.data = {
        missions: [],
        tasks: [],
        taskDependencies: [],
        artifacts: [],
        userState: {},
        schedules: []
      };
      await this._save();
    }
  }

  private async _save() {
    if (!this.data) return;
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private async _withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.lockPromise.then(async () => {
      await this._ensureLoaded();
      return fn();
    });
    this.lockPromise = next.then(() => {}).catch(() => {});
    return next;
  }

  async createMission(params: any) {
    return this._withLock(async () => {
      const mission = {
        id: params.id || uuidv4(),
        user_id: params.userId,
        workspace_id: params.workspaceId,
        goal: params.goal,
        goal_type: params.goalType,
        dag_data: params.dagData,
        status: 'queued',
        created_at: new Date().toISOString()
      };
      this.data!.missions.push(mission);
      
      if (params.tasks) {
        await this.batchCreateTasks(params.tasks.map(t => ({ ...t, missionId: mission.id })));
      }

      await this._save();
      return mission;
    });
  }

  async getMissionById(missionId: string) {
    return this._withLock(async () => {
      return this.data!.missions.find(m => m.id === missionId);
    });
  }

  async updateMissionStatus(missionId: string, status: string, completedAt?: string) {
    return this._withLock(async () => {
      const mission = this.data!.missions.find(m => m.id === missionId);
      if (mission) {
        mission.status = status;
        if (completedAt) mission.completed_at = completedAt;
        mission.updated_at = new Date().toISOString();
        await this._save();
      }
    });
  }

  async getActiveMissions() {
    return this._withLock(async () => {
      return this.data!.missions.filter(m => ['queued', 'running'].includes(m.status));
    });
  }

  async createTask(params: any) {
    return this._withLock(async () => {
      const task = {
        id: params.id || uuidv4(),
        mission_id: params.missionId,
        workspace_id: params.workspaceId,
        label: params.label,
        agent_type: params.agentType,
        input_payload: params.inputPayload,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      this.data!.tasks.push(task);
      
      if (params.dependencies) {
        params.dependencies.forEach((depId: string) => {
          this.data!.taskDependencies.push({
            task_id: task.id,
            depends_on_task_id: depId
          });
        });
      }

      await this._save();
      return task;
    });
  }

  async batchCreateTasks(tasks: any[]) {
    return this._withLock(async () => {
      const created = tasks.map(t => ({
        id: t.id || uuidv4(),
        mission_id: t.missionId,
        workspace_id: t.workspaceId,
        label: t.label,
        agent_type: t.agentType,
        input_payload: t.inputPayload,
        status: 'pending',
        parent_task_id: t.parentTaskId,
        map_reduce_role: t.mapReduceRole,
        created_at: new Date().toISOString()
      }));

      this.data!.tasks.push(...created);

      tasks.forEach(t => {
        if (t.dependencies) {
          t.dependencies.forEach((depId: string) => {
            this.data!.taskDependencies.push({
              task_id: t.id,
              depends_on_task_id: depId
            });
          });
        }
      });

      await this._save();
      return created;
    });
  }

  async getTask(taskId: string) {
    return this._withLock(async () => {
      const task = this.data!.tasks.find(t => t.id === taskId);
      if (task) {
        task.task_dependencies = this.data!.taskDependencies
          .filter(d => d.task_id === taskId)
          .map(d => ({ depends_on_task_id: d.depends_on_task_id }));
      }
      return task;
    });
  }

  async getMissionTasks(missionId: string) {
    return this._withLock(async () => {
      return this.data!.tasks
        .filter(t => t.mission_id === missionId)
        .map(t => ({
          ...t,
          task_dependencies: this.data!.taskDependencies
            .filter(d => d.task_id === t.id)
            .map(d => ({ depends_on_task_id: d.depends_on_task_id }))
        }));
    });
  }

  async getTaskStatuses(taskIds: string[]) {
    return this._withLock(async () => {
      return this.data!.tasks
        .filter(t => taskIds.includes(t.id))
        .map(t => ({ id: t.id, status: t.status }));
    });
  }

  async getDependentTasks(taskId: string) {
    return this._withLock(async () => {
      const depIds = this.data!.taskDependencies
        .filter(d => d.depends_on_task_id === taskId)
        .map(d => d.task_id);
      
      return this.data!.tasks
        .filter(t => depIds.includes(t.id))
        .map(t => ({
          ...t,
          task_dependencies: this.data!.taskDependencies
            .filter(d => d.task_id === t.id)
            .map(d => ({ depends_on_task_id: d.depends_on_task_id }))
        }));
    });
  }

  async updateTaskStatus(taskId: string, status: string, result?: any) {
    return this._withLock(async () => {
      const task = this.data!.tasks.find(t => t.id === taskId);
      if (!task) return false;

      // Logic check like in MissionStore
      if (status === 'queued' && task.status !== 'pending') return false;

      task.status = status;
      if (status === 'running') task.started_at = new Date().toISOString();
      if (status === 'completed' || status === 'failed') task.completed_at = new Date().toISOString();
      if (result?.artifactId) task.output_artifact_id = result.artifactId;
      if (result?.tokensUsed) task.tokens_used = result.tokensUsed;
      if (result?.error) task.error = result.error;

      await this._save();
      return true;
    });
  }

  async updateTaskCheckpoint(taskId: string, checkpoint: any) {
    return this._withLock(async () => {
      const task = this.data!.tasks.find(t => t.id === taskId);
      if (task) {
        task.input_payload = {
          ...task.input_payload,
          _checkpoint: {
            ...checkpoint,
            updatedAt: new Date().toISOString()
          }
        };
        await this._save();
      }
    });
  }

  async completeTaskAtomic(params: any) {
    return this._withLock(async () => {
      const artifact = await this.storeArtifact(params);
      await this.updateTaskStatus(params.taskId, 'completed', {
        artifactId: artifact.id,
        tokensUsed: params.tokensUsed
      });
      return artifact;
    });
  }

  async storeArtifact(params: any) {
    return this._withLock(async () => {
      const artifact = {
        id: uuidv4(),
        mission_id: params.missionId,
        task_id: params.taskId,
        type: params.type,
        content: params.content,
        created_at: new Date().toISOString()
      };
      this.data!.artifacts.push(artifact);
      await this._save();
      return artifact;
    });
  }

  async fetchArtifactsByContext(missionId: string, taskIds: string[]) {
    return this._withLock(async () => {
      return this.data!.artifacts.filter(a => a.mission_id === missionId && taskIds.includes(a.task_id));
    });
  }

  async getUserState(userId: string) {
    return this._withLock(async () => {
      return this.data!.userState[userId] || null;
    });
  }

  async upsertUserState(userId: string, state: UserStateSnapshot) {
    return this._withLock(async () => {
      this.data!.userState[userId] = state;
      await this._save();
    });
  }

  async upsertSchedule(userId: string, schedule: ScheduleSnapshot) {
    return this._withLock(async () => {
      const idx = this.data!.schedules.findIndex(s => s.id === schedule.scheduleId);
      const row = {
        id: schedule.scheduleId,
        workspace_id: schedule.workspaceId,
        cron_expression: schedule.cron,
        status: 'active',
        updated_at: new Date().toISOString()
      };
      if (idx >= 0) this.data!.schedules[idx] = row;
      else this.data!.schedules.push(row);
      await this._save();
    });
  }

  async listAllSchedules() {
    return this._withLock(async () => {
      return this.data!.schedules;
    });
  }
}
