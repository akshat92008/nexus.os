import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger.js';

export interface RecordedInteraction {
  taskId: string;
  agentType: string;
  input: any;
  output: any;
  metadata?: Record<string, any>;
}

const RECORDINGS_DIR = path.join(process.cwd(), '.nexus-recordings');

export let isRecordMode = process.env.MISSION_REPLAY_MODE === 'record';
export let isReplayMode = process.env.MISSION_REPLAY_MODE === 'replay';

export class MissionRecorder {
  interactions: RecordedInteraction[] = [];
  isRecording = false;

  startRecording(): void {
    this.isRecording = true;
    isRecordMode = true;
    this.interactions = [];
  }

  stopRecording(): void {
    this.isRecording = false;
    isRecordMode = false;
  }

  recordInteraction(interaction: RecordedInteraction): void {
    if (!this.isRecording && !isRecordMode) return;
    this.interactions.push(interaction);
  }

  async saveRecording(): Promise<string> {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true });
    const target = path.join(RECORDINGS_DIR, `mission-${Date.now()}.json`);
    await fs.writeFile(target, JSON.stringify(this.interactions, null, 2), 'utf-8');
    return target;
  }
}

export class MissionReplayer {
  private recordings: RecordedInteraction[] = [];

  enableReplayMode(): void {
    isReplayMode = true;
  }

  disableReplayMode(): void {
    isReplayMode = false;
  }

  async loadRecordings(): Promise<void> {
    try {
      const files = await fs.readdir(RECORDINGS_DIR);
      const payloads = await Promise.all(
        files
          .filter((file) => file.endsWith('.json'))
          .map(async (file) => JSON.parse(await fs.readFile(path.join(RECORDINGS_DIR, file), 'utf-8'))),
      );

      this.recordings = payloads.flat();
    } catch (err) {
      this.recordings = [];
      logger.debug({ err }, '[MissionReplay] No recordings loaded');
    }
  }

  getReplayResponse(taskId: string, agentType: string, input: any): any | null {
    const found = this.recordings.find((recording) => {
      if (recording.taskId !== taskId) return false;
      if (recording.agentType !== agentType) return false;

      if (input?.taskNode?.id && recording.input?.taskNode?.id) {
        return input.taskNode.id === recording.input.taskNode.id;
      }

      return true;
    });

    return found?.output ?? null;
  }
}

export const missionRecorder = new MissionRecorder();
export const missionReplayer = new MissionReplayer();

