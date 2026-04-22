/**
 * Nexus OS — Real-time Voice / Audio Pipeline
 * Speech-to-text, text-to-speech, and voice conversation management
 * Inspired by OpenClaw realtime-transcription and realtime-voice
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { randomUUID } from 'crypto';

export type VoiceSessionStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceSession {
  id: string;
  status: VoiceSessionStatus;
  mode: 'push-to-talk' | 'continuous' | 'wake-word';
  wakeWord?: string;
  language: string;
  model: string;
  ttsVoice: string;
  ttsProvider: 'openai' | 'macos' | 'elevenlabs';
  autoReply: boolean;
  createdAt: Date;
  lastActivityAt: Date;
  transcriptBuffer: string[];
  metadata: Record<string, any>;
}

export interface VoiceChunk {
  id: string;
  sessionId: string;
  type: 'audio_in' | 'transcript' | 'ai_response' | 'audio_out';
  data: any;
  timestamp: Date;
  duration?: number;
}

class VoiceManager {
  private sessions: Map<string, VoiceSession> = new Map();
  private activeRecordings: Map<string, any> = new Map(); // Microphone stream handles
  private isRecording: boolean = false;

  async initialize() {
    logger.info('[VoiceManager] Initializing voice pipeline...');
    // Pre-warm TTS voices
    logger.info('[VoiceManager] Voice system ready');
  }

  async startSession(params: {
    mode?: VoiceSession['mode'];
    wakeWord?: string;
    language?: string;
    model?: string;
    ttsVoice?: string;
    ttsProvider?: VoiceSession['ttsProvider'];
    autoReply?: boolean;
  } = {}): Promise<VoiceSession> {
    const session: VoiceSession = {
      id: randomUUID(),
      status: 'idle',
      mode: params.mode || 'push-to-talk',
      wakeWord: params.wakeWord,
      language: params.language || 'en',
      model: params.model || 'whisper-1',
      ttsVoice: params.ttsVoice || 'alloy',
      ttsProvider: params.ttsProvider || 'openai',
      autoReply: params.autoReply !== false,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      transcriptBuffer: [],
      metadata: {}
    };

    this.sessions.set(session.id, session);
    
    if (session.mode === 'continuous' || session.mode === 'wake-word') {
      await this.startListening(session.id);
    }

    logger.info(`[VoiceManager] Session started: ${session.id} (${session.mode})`);
    return session;
  }

  async startListening(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'listening';
    session.lastActivityAt = new Date();

    // In a real implementation, this would start a microphone stream
    // and pipe it to Whisper API or local STT model
    logger.info(`[VoiceManager:${sessionId}] Started listening`);

    // Simulate push-to-talk for now — in production this uses:
    // - node-microphone or sox for audio capture
    // - WebSocket to Whisper API or local Whisper.cpp
    // - VAD (Voice Activity Detection) for continuous mode
  }

  async stopListening(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'processing';
    
    // In production: finalize audio buffer, send to STT
    const transcript = session.transcriptBuffer.join(' ');
    session.transcriptBuffer = [];

    logger.info(`[VoiceManager:${sessionId}] Stopped listening, transcript: ${transcript.slice(0, 100)}`);
    return transcript;
  }

  async processTranscript(sessionId: string, transcript: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'processing';
    session.lastActivityAt = new Date();

    // Send to AI via event bus
    const response = await eventBus.publish('voice_request', {
      sessionId,
      transcript,
      timestamp: new Date()
    });

    // Default: use LLMRouter directly
    const { llmRouter } = await import('../llm/LLMRouter.js');
    const aiResponse = await llmRouter.call({
      system: 'You are a helpful voice assistant. Keep responses concise and natural for spoken conversation.',
      user: transcript,
      model: 'llama-3.3-70b'
    });

    const reply = aiResponse.content || 'I did not understand that.';
    
    if (session.autoReply) {
      await this.speak(sessionId, reply);
    }

    return reply;
  }

  async speak(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'speaking';

    // Use TTS skill
    const { skillManager } = await import('../skills/skillManager.js');
    
    try {
      await skillManager.executeTool('tts_speak', {
        text,
        voice: session.ttsVoice,
        provider: session.ttsProvider === 'macos' ? 'macos' : 'openai'
      });
    } catch (err) {
      logger.warn({ err }, `[VoiceManager:${sessionId}] TTS failed, falling back to macOS say`);
      // Fallback to say command
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(execFile)('say', ['-v', 'Samantha', text]);
    }

    session.status = session.mode === 'continuous' ? 'listening' : 'idle';
    session.lastActivityAt = new Date();
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'idle';
    this.activeRecordings.delete(sessionId);
    
    logger.info(`[VoiceManager] Session stopped: ${sessionId}`);
  }

  async saveChunk(chunk: Omit<VoiceChunk, 'id' | 'timestamp'>): Promise<VoiceChunk> {
    const supabase = await getSupabase();
    
    const voiceChunk: VoiceChunk = {
      id: randomUUID(),
      ...chunk,
      timestamp: new Date()
    };

    await supabase.from('voice_chunks').insert({
      id: voiceChunk.id,
      session_id: voiceChunk.sessionId,
      type: voiceChunk.type,
      data: voiceChunk.data,
      timestamp: voiceChunk.timestamp.toISOString(),
      duration: voiceChunk.duration
    });

    return voiceChunk;
  }

  getSession(id: string): VoiceSession | undefined {
    return this.sessions.get(id);
  }

  getActiveSessions(): VoiceSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status !== 'idle');
  }
}

export const voiceManager = new VoiceManager();
