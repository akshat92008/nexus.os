/**
 * Nexus OS — ILLMProvider
 *
 * Generic interface for all LLM providers (Groq, Gemini, etc.)
 */

export interface LLMCallOpts {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
  enableStreaming?: boolean;
  onStreamChunk?: (chunk: string) => void;
  preferProvider?: 'cerebras' | 'gemini' | 'openrouter' | 'groq';
}

export interface LLMResponse {
  content: string;
  tokens: number;
}

export interface ILLMProvider {
  call(opts: LLMCallOpts): Promise<LLMResponse>;
}
