/**
 * Nexus OS — Mission Replay System
 *
 * Records and replays agent interactions for deterministic testing.
 * Enables reliable end-to-end testing of mission orchestration.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentType, TypedArtifact, TaskNode } from '@nexus-os/types';

export interface AgentInteraction {
  taskId: string;
  agentType: AgentType;
  input: {
    prompt: string;
    context: Record<string, TypedArtifact>;
    taskNode: TaskNode;
  };
  output: TypedArtifact;
  timestamp: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface MissionRecording {
  missionId: string;
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  interactions: AgentInteraction[];
  finalResult?: any;
  metadata?: Record<string, any>;
}

export class MissionRecorder {
  private interactions: AgentInteraction[] = [];
  private recording: MissionRecording;
  private startTime: number;
  private isRecording: boolean = false;

  constructor(
    private missionId: string,
    private sessionId: string,
    private userId: string,
    private storagePath: string = './test-recordings'
  ) {
    this.startTime = Date.now();
    this.recording = {
      missionId,
      sessionId,
      userId,
      startTime: this.startTime,
      interactions: []
    };
  }

  startRecording(): void {
    this.isRecording = true;
    this.interactions = [];
  }

  recordInteraction(interaction: Omit<AgentInteraction, 'timestamp' | 'duration'>): void {
    if (!this.isRecording) return;

    const timestamp = Date.now();
    const fullInteraction: AgentInteraction = {
      ...interaction,
      timestamp,
      duration: timestamp - this.startTime
    };

    this.interactions.push(fullInteraction);
    this.recording.interactions = [...this.interactions];
  }

  async saveRecording(finalResult?: any): Promise<string> {
    if (!this.isRecording) throw new Error('Not currently recording');

    this.recording.endTime = Date.now();
    this.recording.finalResult = finalResult;

    // Ensure storage directory exists
    await fs.mkdir(this.storagePath, { recursive: true });

    const filename = `${this.missionId}-${this.startTime}.json`;
    const filepath = path.join(this.storagePath, filename);

    await fs.writeFile(filepath, JSON.stringify(this.recording, null, 2));

    this.isRecording = false;
    return filepath;
  }

  getCurrentRecording(): MissionRecording {
    return { ...this.recording, interactions: [...this.interactions] };
  }
}

export class MissionReplayer {
  private recordings: Map<string, MissionRecording> = new Map();
  private replayMode: boolean = false;
  private currentReplayIndex: Map<string, number> = new Map();

  constructor(private storagePath: string = './test-recordings') {}

  async loadRecordings(): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath);
      const recordingFiles = files.filter(f => f.endsWith('.json'));

      for (const file of recordingFiles) {
        const filepath = path.join(this.storagePath, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const recording: MissionRecording = JSON.parse(content);
        this.recordings.set(recording.missionId, recording);
      }
    } catch (error) {
      // Directory doesn't exist or no recordings yet
      console.warn('No existing recordings found:', error);
    }
  }

  enableReplayMode(): void {
    this.replayMode = true;
  }

  disableReplayMode(): void {
    this.replayMode = false;
    this.currentReplayIndex.clear();
  }

  getReplayResponse(
    taskId: string,
    agentType: AgentType,
    input: { prompt: string; context: Record<string, TypedArtifact>; taskNode: TaskNode }
  ): TypedArtifact | null {
    if (!this.replayMode) return null;

    // Find matching recording and interaction
    for (const recording of this.recordings.values()) {
      const interaction = recording.interactions.find(interaction =>
        interaction.taskId === taskId &&
        interaction.agentType === agentType &&
        this.inputsMatch(interaction.input, input)
      );

      if (interaction) {
        return interaction.output;
      }
    }

    return null;
  }

  private inputsMatch(
    recorded: { prompt: string; context: Record<string, TypedArtifact>; taskNode: TaskNode },
    current: { prompt: string; context: Record<string, TypedArtifact>; taskNode: TaskNode }
  ): boolean {
    // Simple matching - in production, you might want more sophisticated matching
    return recorded.prompt === current.prompt &&
           recorded.taskNode.id === current.taskNode.id &&
           recorded.agentType === current.taskNode.agentType;
  }

  getAvailableRecordings(): string[] {
    return Array.from(this.recordings.keys());
  }

  getRecording(missionId: string): MissionRecording | undefined {
    return this.recordings.get(missionId);
  }
}

// Global instances for use across the application
export const missionRecorder = new MissionRecorder(
  'test-mission',
  'test-session',
  'test-user'
);

export const missionReplayer = new MissionReplayer();

// Environment-based configuration
export const isReplayMode = process.env.MISSION_REPLAY_MODE === 'replay';
export const isRecordMode = process.env.MISSION_REPLAY_MODE === 'record';

if (isReplayMode) {
  missionReplayer.enableReplayMode();
  await missionReplayer.loadRecordings();
}