import { logger } from '../logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VoiceSession {
  id: string;
  isListening: boolean;
  transcript: string;
  lastActive: Date;
}

class VoiceManager {
  private sessions: Map<string, VoiceSession> = new Map();
  private isConfigured: boolean = false;

  async initialize() {
    logger.info('[VoiceManager] Initializing voice system...');
    // Check for whisper or other keys if needed, for now assume degraded/text-only is fine
    this.isConfigured = !!process.env.WHISPER_API_KEY;
    if (!this.isConfigured) {
      logger.warn('[VoiceManager] WHISPER_API_KEY not set. Running in text-only mode.');
    }
    logger.info('[VoiceManager] Ready');
  }

  async startSession(userId: string): Promise<VoiceSession> {
    const session: VoiceSession = {
      id: userId,
      isListening: false,
      transcript: '',
      lastActive: new Date()
    };
    this.sessions.set(userId, session);
    return session;
  }

  async startListening(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      session.isListening = true;
      session.lastActive = new Date();
    }
  }

  async stopListening(userId: string): Promise<string> {
    const session = this.sessions.get(userId);
    if (session) {
      session.isListening = false;
      return session.transcript || 'No speech detected (text-only mode)';
    }
    return '';
  }

  async processTranscript(userId: string, text: string): Promise<string> {
    const { llmRouter } = await import('../llm/LLMRouter.js');
    const response = await llmRouter.call({
      system: 'You are a voice assistant for Nexus OS.',
      user: text,
      model: 'llama-3.3-70b'
    });
    return response.content || 'I processed your request.';
  }

  async speak(userId: string, text: string): Promise<void> {
    logger.info({ userId, text }, '[VoiceManager] Speaking');
    if (process.platform === 'darwin') {
      try {
        await execAsync(`say "${text.replace(/"/g, '')}"`);
      } catch (err) {
        logger.warn({ err }, '[VoiceManager] macOS say failed');
      }
    } else {
      logger.info('[VoiceManager] TTS skipped (non-macOS platform)');
    }
  }
}

export const voiceManager = new VoiceManager();
