/**
 * Nexus OS — Mission & Task Store
 *
 * Handles the durable persistence of complex multi-agent missions,
 * individual tasks, and the resulting artifacts.
 *
 * Refactored to delegate to a PersistenceProvider (Supabase or Local FS).
 */

import type { AgentType, TypedArtifact, ScheduleSnapshot } from '@nexus-os/types';
import { getPersistenceProvider } from './persistenceFactory.js';
import { userStateStore } from './userStateStore.js';

export class MissionStore {
  private get provider() {
    return getPersistenceProvider();
  }

  async createMission(params: {
    id?: string;
    userId: string;
    workspaceId?: string;
    goal: string;
    goalType?: string;
    dagData?: any;
    tasks?: any[];
  }) {
    return this.provider.createMission(params);
  }

  async updateMissionStatus(missionId: string, status: string, completedAt?: string) {
    return this.provider.updateMissionStatus(missionId, status, completedAt);
  }

  async createTask(params: {
    id?: string;
    missionId: string;
    workspaceId?: string;
    label: string;
    agentType: AgentType;
    inputPayload: any;
    dependencies?: string[];
  }) {
    return this.provider.createTask(params);
  }

  async batchCreateTasks(tasks: any[]) {
    return this.provider.batchCreateTasks(tasks);
  }

  async updateTaskStatus(taskId: string, status: string, result?: { artifactId?: string; tokensUsed?: number; error?: string }) {
    return this.provider.updateTaskStatus(taskId, status, result);
  }

  async completeTaskAtomics(params: {
    missionId: string;
    taskId: string;
    type: string;
    content: TypedArtifact;
    tokensUsed: number;
  }) {
    return this.provider.completeTaskAtomic(params);
  }

  async updateTaskCheckpoint(taskId: string, checkpoint: { 
    step: string; 
    data?: any; 
    tokensUsed?: number;
  }) {
    return this.provider.updateTaskCheckpoint(taskId, checkpoint);
  }

  async storeArtifact(params: {
    missionId: string;
    taskId: string;
    type: string;
    content: TypedArtifact;
  }) {
    return this.provider.storeArtifact(params);
  }

  async fetchArtifactsByContext(missionId: string, taskIds: string[]) {
    return this.provider.fetchArtifactsByContext(missionId, taskIds);
  }

  async getTask(taskId: string) {
    return this.provider.getTask(taskId);
  }

  async getMissionById(missionId: string) {
    return this.provider.getMissionById(missionId);
  }

  async getMissionTasks(missionId: string) {
    return this.provider.getMissionTasks(missionId);
  }

  async getTaskStatuses(taskIds: string[]) {
    return this.provider.getTaskStatuses(taskIds);
  }

  async getDependentTasks(taskId: string) {
    return this.provider.getDependentTasks(taskId);
  }

  async upsertSchedule(userId: string, schedule: ScheduleSnapshot) {
    await this.provider.upsertSchedule(userId, schedule);

    return userStateStore.mutateUserState(userId, (state) => {
      const idx = state.schedules.findIndex(s => s.scheduleId === schedule.scheduleId);
      if (idx >= 0) state.schedules[idx] = schedule;
      else state.schedules.unshift(schedule);
    });
  }

  async listAllSchedules() {
    return this.provider.listAllSchedules();
  }

  async getActiveMissions() {
    return this.provider.getActiveMissions();
  }
}

export const missionStore = new MissionStore();
