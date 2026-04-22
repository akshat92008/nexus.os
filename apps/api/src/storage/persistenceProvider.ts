import type { 
  AgentType, 
  TypedArtifact, 
  ScheduleSnapshot, 
  UserStateSnapshot, 
  Workspace,
  MissionStatus,
  TaskStatus
} from '@nexus-os/types';

export interface PersistenceProvider {
  // Mission Operations
  createMission(params: {
    id?: string;
    userId: string;
    workspaceId?: string;
    goal: string;
    goalType?: string;
    dagData?: any;
    tasks?: any[];
  }): Promise<any>;

  getMissionById(missionId: string): Promise<any>;
  updateMissionStatus(missionId: string, status: string, completedAt?: string): Promise<void>;
  getActiveMissions(): Promise<any[]>;

  // Task Operations
  createTask(params: {
    id?: string;
    missionId: string;
    workspaceId?: string;
    label: string;
    agentType: AgentType;
    inputPayload: any;
    dependencies?: string[];
  }): Promise<any>;

  batchCreateTasks(tasks: any[]): Promise<any[]>;
  getTask(taskId: string): Promise<any>;
  getMissionTasks(missionId: string): Promise<any[]>;
  getTaskStatuses(taskIds: string[]): Promise<any[]>;
  getDependentTasks(taskId: string): Promise<any[]>;
  updateTaskStatus(taskId: string, status: string, result?: any): Promise<boolean>;
  updateTaskCheckpoint(taskId: string, checkpoint: any): Promise<void>;
  completeTaskAtomic(params: {
    missionId: string;
    taskId: string;
    type: string;
    content: TypedArtifact;
    tokensUsed: number;
  }): Promise<any>;

  // Artifact Operations
  storeArtifact(params: {
    missionId: string;
    taskId: string;
    type: string;
    content: TypedArtifact;
  }): Promise<any>;

  fetchArtifactsByContext(missionId: string, taskIds: string[]): Promise<any[]>;

  // User State Operations
  getUserState(userId: string): Promise<UserStateSnapshot | null>;
  upsertUserState(userId: string, state: UserStateSnapshot): Promise<void>;

  // Schedule Operations
  upsertSchedule(userId: string, schedule: ScheduleSnapshot): Promise<void>;
  listAllSchedules(): Promise<any[]>;
}
