// apps/api/src/core/aiProxy/providers/base.ts

export interface AIResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AIProvider {
  name: string;
  generate(modelId: string, system: string, prompt: string, maxTokens: number): Promise<AIResponse>;
}
