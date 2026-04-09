import { ILLMProvider, LLMCallOpts, LLMResponse } from './ILLMProvider.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { GroqProvider } from './GroqProvider.js';

/**
 * Nexus OS — LLMRouter
 *
 * Consolidates all LLM interactions through OpenRouter with a smart
 * rotation strategy across free models. Includes a final Groq fallback
 * for high-priority mission continuity.
 */

// Tiered model constants
export const MODEL_FAST = 'MODEL_FAST';
export const MODEL_POWER = 'MODEL_POWER';
export const MODEL_CODE = 'MODEL_CODE';
export const MODEL_VISION = 'MODEL_VISION';

// Rotation lists for free models (OpenRouter)
export const FREE_MODELS = { 
  [MODEL_FAST]: [ 
    'meta-llama/llama-3.1-8b-instruct:free', 
    'mistralai/mistral-7b-instruct:free', 
    'google/gemini-2.0-flash-exp:free', 
    'microsoft/phi-3-mini-128k-instruct:free', 
  ], 
  [MODEL_POWER]: [ 
    'deepseek/deepseek-r1:free', 
    'meta-llama/llama-3.3-70b-instruct:free', 
    'qwen/qwen-2.5-72b-instruct:free', 
    'google/gemini-2.0-flash-exp:free', 
  ], 
  [MODEL_CODE]: [ 
    'qwen/qwen-2.5-coder-32b-instruct:free', 
    'deepseek/deepseek-r1:free', 
    'meta-llama/llama-3.3-70b-instruct:free', 
  ], 
  [MODEL_VISION]: [ 
    'google/gemini-2.0-flash-exp:free', 
    'meta-llama/llama-3.2-11b-vision-instruct:free', 
    'meta-llama/llama-3.1-8b-instruct:free', 
  ], 
};

export class LLMRouter {
  private primary: ILLMProvider;
  private groqFallback: ILLMProvider;
  private rotationIndices: Record<string, number> = {
    [MODEL_FAST]: 0,
    [MODEL_POWER]: 0,
    [MODEL_CODE]: 0,
    [MODEL_VISION]: 0,
  };

  constructor() {
    this.primary = new OpenRouterProvider();
    this.groqFallback = new GroqProvider();
  }

  /**
   * Main entry point for LLM calls with tier-based routing and rotation.
   * If all rotation attempts fail, falls back to Groq.
   */
  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    // 0. Context Compression Middleware
    if (opts.user.length > 20000) {
      console.log(`[LLMRouter] 🗜️ Compressing large user context (${opts.user.length} chars)...`);
      try {
        const summary = await this.call({
          system: 'Summarize the following agent findings concisely, preserving all key metrics, names, and strategic decisions. Output a bulleted list.',
          user: opts.user.slice(0, 40000), // Take a large chunk but not all if it's extreme
          model: MODEL_FAST,
          maxTokens: 1000,
          temperature: 0.3,
        });
        opts.user = `[SUMMARY OF PRIOR CONTEXT]\n${summary.content}\n\n[LATEST CONTEXT]\n${opts.user.slice(-5000)}`;
      } catch (err) {
        console.warn('[LLMRouter] Context compression failed, proceeding with truncated text:', err);
        opts.user = opts.user.slice(0, 20000);
      }
    }

    const tier = this.resolveTier(opts.model);
    const models = (FREE_MODELS as any)[tier] || [opts.model];
    
    let lastError: any;
    const startIndex = this.rotationIndices[tier] || 0;
    const maxAttempts = Math.min(models.length, 3);

    // 1. Try OpenRouter Rotation
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const modelIndex = (startIndex + attempt) % models.length;
      const model = models[modelIndex];
      
      try {
        const response = await this.primary.call({
          ...opts,
          model,
        });

        this.rotationIndices[tier] = (modelIndex + 1) % models.length;
        return response;

      } catch (err: any) {
        lastError = err;
        const isRateLimit = err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit');
        
        if (isRateLimit) {
          console.warn(`[LLMRouter] ${model} rate limited, trying next model in tier ${tier}...`);
          continue;
        }

        console.error(`[LLMRouter] OpenRouter error with ${model}: ${err.message}`);
      }
    }

    // 2. Final Fallback to Groq
    console.warn(`[LLMRouter] All rotation attempts failed. Engaging Groq fallback for tier ${tier}...`);
    try {
      const groqModel = this.mapToGroqModel(tier);
      return await this.groqFallback.call({
        ...opts,
        model: groqModel,
      });
    } catch (err: any) {
      console.error(`[LLMRouter] Groq fallback failed: ${err.message}`);
      throw lastError || err;
    }
  }

  /**
   * Convenience method for agents
   */
  async callSimple(system: string, user: string, tier: string = MODEL_FAST, jsonMode = false): Promise<string> {
    const res = await this.call({
      system,
      user,
      model: tier,
      maxTokens: 2000,
      temperature: 0.7,
      jsonMode,
    });
    return res.content;
  }

  private resolveTier(modelName: string): string {
    const name = modelName.toLowerCase();
    if (name === MODEL_POWER.toLowerCase() || name.includes('power') || name.includes('synthesis') || name.includes('chief')) return MODEL_POWER;
    if (name === MODEL_CODE.toLowerCase() || name.includes('code') || name.includes('coder') || name.includes('developer')) return MODEL_CODE;
    if (name === MODEL_VISION.toLowerCase() || name.includes('vision') || name.includes('multimodal') || name.includes('see')) return MODEL_VISION;
    return MODEL_FAST;
  }

  private mapToGroqModel(tier: string): string {
    switch (tier) {
      case MODEL_POWER:
      case MODEL_CODE:
        return 'llama-3.3-70b-versatile';
      case MODEL_FAST:
      default:
        return 'llama3-8b-8192';
    }
  }
}

export const llmRouter = new LLMRouter();
