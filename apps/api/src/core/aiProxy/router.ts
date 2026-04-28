// apps/api/src/core/aiProxy/router.ts
import { GroqProvider } from './providers/groq.js';
import { NvidiaProvider } from './providers/nvidia.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import { GeminiProvider } from './providers/gemini.js';
import { TASK_ROUTING } from './config/models.js';

const providers: Record<string, any> = {
  groq: new GroqProvider(),
  nvidia: new NvidiaProvider(),
  openrouter: new OpenRouterProvider(),
  gemini: new GeminiProvider(),
};

/**
 * Timeout wrapper to prevent hanging requests from bankrupting system threads
 */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Provider Timeout')), ms))
  ]);
};

export async function executeWithFallback(
  taskType: string,
  system: string,
  prompt: string
): Promise<{ content: string; modelUsed: string; promptTokens: number; completionTokens: number; fallbackUsed: boolean }> {
  
  const route = TASK_ROUTING[taskType] || TASK_ROUTING['analytics_insights']; // default high-tier
  const modelsToTry = [route.primary, ...route.fallbacks];
  let fallbackUsed = false;

  for (const modelIdentifier of modelsToTry) {
    const [providerName, modelId] = modelIdentifier.split(':');
    const provider = providers[providerName];

    if (!provider) continue;

    try {
      // 10 second timeout per provider
      const response = await withTimeout(
        provider.generate(modelId, system, prompt, route.defaultMaxTokens), 
        10000 
      );

      return {
        content: response.content,
        modelUsed: modelIdentifier,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        fallbackUsed
      };

    } catch (error: any) {
      console.warn(`[AI Router] ${modelIdentifier} failed: ${error.message}. Attempting fallback...`);
      fallbackUsed = true;
      continue; // Try next model
    }
  }

  // Absolute last resort
  return {
    content: JSON.stringify({ error: "All AI providers temporarily unavailable. Please try again." }),
    modelUsed: "system_fallback",
    promptTokens: 0,
    completionTokens: 0,
    fallbackUsed: true
  };
}
