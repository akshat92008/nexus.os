/**
 * Nexus OS — Mission Replay System
 *
 * Records and replays agent interactions for deterministic testing.
 * Enables reliable end-to-end testing of mission orchestration.
 */

import { getSupabase } from './storage/supabaseClient.js';
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
    private bucket: string = 'mission-replays'
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

    const client = await getSupabase();
    const filename = `${this.missionId}-${this.startTime}.json`;
    const content = JSON.stringify(this.recording, null, 2);

    const { error } = await client.storage
      .from(this.bucket)
      .upload(filename, content, {
        contentType: 'application/json',
        upsert: true
      });

    if (error) {
      console.error('[MissionRecorder] Storage upload failed:', error);
      throw new Error(`Failed to save recording to Supabase: ${error.message}`);
    }

    this.isRecording = false;
    return filename;
  }

  getCurrentRecording(): MissionRecording {
    return { ...this.recording, interactions: [...this.interactions] };
  }
}

export class MissionReplayer {
  private recordings: Map<string, MissionRecording> = new Map();
  private replayMode: boolean = false;
  private currentReplayIndex: Map<string, number> = new Map();

  constructor(private bucket: string = 'mission-replays') {}

  async loadRecordings(): Promise<void> {
    try {
      const client = await getSupabase();
      const { data: files, error: listError } = await client.storage
        .from(this.bucket)
        .list();

      if (listError) throw listError;
      if (!files) return;

      for (const file of files) {
        if (!file.name.endsWith('.json')) continue;
        
        const { data, error: downloadError } = await client.storage
          .from(this.bucket)
          .download(file.name);

        if (downloadError) {
          console.warn(`[MissionReplayer] Failed to download ${file.name}:`, downloadError);
          continue;
        }

        const content = await data.text();
        const recording: MissionRecording = JSON.parse(content);
        this.recordings.set(recording.missionId, recording);
      }
    } catch (error) {
      console.warn('No existing recordings found or storage access failed:', error);
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
    return recorded.prompt === current.prompt &&
           recorded.taskNode.id === current.taskNode.id &&
           recorded.taskNode.agentType === current.taskNode.agentType;
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