import { ILLMProvider, LLMCallOpts, LLMResponse } from './ILLMProvider.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { GroqProvider } from './GroqProvider.js';
import { rateLimitMonitor } from './RateLimitMonitor.js';
import { createBreaker } from '../circuitBreaker.js';
import { withRetry } from '../resilience.js';
import { logger } from '../logger.js';
// --- Gemini/Claude/Local Fallback Providers (stubs) ---
class GeminiProvider {
  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;
    const body = {
      contents: [{ role: 'user', parts: [{ text: `System: ${opts.system}\n\nUser: ${opts.user}` }]}],
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens ?? 2048
      }
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Gemini API error: ' + res.status);
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '[Gemini: No response]';
    
    // Extract usage metadata for billing/metrics (Ticket 3)
    const usage = data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
    } : { promptTokens: 0, completionTokens: 0 };

    return { 
      content, 
      tokens: usage.promptTokens + usage.completionTokens
    };
  }
}
class LocalProvider {
  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    return { content: '[LOCAL LLM FALLBACK] No external provider available.', tokens: 0 };
  }
}

/**
 * Nexus OS — LLMRouter
 *
 * Consolidates all LLM interactions through OpenRouter with a smart
 * rotation strategy across free models. Includes multi-provider routing
 * and a final Groq fallback for mission continuity.
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
    'microsoft/phi-3-mini-128k-instruct:free', 
  ], 
  [MODEL_POWER]: [ 
    'deepseek/deepseek-r1:free', 
    'meta-llama/llama-3.3-70b-instruct:free', 
    'qwen/qwen-2.5-72b-instruct:free', 
  ], 
  [MODEL_CODE]: [ 
    'qwen/qwen-2.5-coder-32b-instruct:free', 
    'deepseek/deepseek-r1:free', 
    'meta-llama/llama-3.3-70b-instruct:free', 
  ], 
  [MODEL_VISION]: [ 
    'meta-llama/llama-3.2-11b-vision-instruct:free', 
    'google/gemini-pro-1.5-vision',
  ], 
};

export class LLMRouter {
  private openRouter: ILLMProvider;
  private groqFallback: ILLMProvider;
  private gemini: ILLMProvider;
  private local: ILLMProvider;
  private rotationIndices: Record<string, number> = {
    [MODEL_FAST]: 0,
    [MODEL_POWER]: 0,
    [MODEL_CODE]: 0,
    [MODEL_VISION]: 0,
  };

  // Circuit breakers (explicitly typed and persisted)
  private openRouterBreaker: ReturnType<typeof createBreaker>;
  private geminiBreaker: ReturnType<typeof createBreaker>;
  private groqBreaker: ReturnType<typeof createBreaker>;

  constructor() {
    this.openRouter = new OpenRouterProvider();
    this.groqFallback = new GroqProvider();
    this.gemini = new GeminiProvider();
    this.local = new LocalProvider();

    // Initialize circuit breakers ONCE at construction
    this.openRouterBreaker = createBreaker((args: LLMCallOpts) => this.openRouter.call(args));
    this.geminiBreaker = createBreaker((args: LLMCallOpts) => this.gemini.call(args));
    this.groqBreaker = createBreaker((args: LLMCallOpts) => this.groqFallback.call(args));
  }

  /**
   * Main entry point for LLM calls with tier-based routing and rotation.
   * If all rotation attempts fail, falls back to Groq.
   */
  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    // 0. Context Compression Middleware
    if (opts.user.length > 20000) {
      logger.info(`[LLMRouter] 🗜️ Compressing large user context (${opts.user.length} chars)...`);
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
        logger.warn({ err }, '[LLMRouter] Context compression failed, proceeding with truncated text');
        opts.user = opts.user.slice(0, 20000);
      }
    }

    const tier = this.resolveTier(opts.model);
    const models = (FREE_MODELS as any)[tier] || [opts.model];
    let lastError: any;

    const startIndex = this.rotationIndices[tier] || 0;
    const maxAttempts = Math.min(models.length, 3);

    // 1. Try OpenRouter Rotation (with circuit breaker)
    if (this.shouldUseProvider('openrouter')) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const modelIndex = (startIndex + attempt) % models.length;
        const model = models[modelIndex];
        if (rateLimitMonitor.isRateLimited('openrouter', model)) {
          logger.warn(`[LLMRouter] Skipping rate-limited OpenRouter model ${model}.`);
          continue;
        }
        try {
          const response = await this.openRouterBreaker.fire({ ...opts, model });
          this.rotationIndices[tier] = (modelIndex + 1) % models.length;
          rateLimitMonitor.recordSuccess('openrouter', model);
          return response;
        } catch (err: any) {
          lastError = err;
          const isRateLimit = err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit');
          if (isRateLimit) {
            const retryAfter = this.extractRetryAfter(err.message);
            rateLimitMonitor.recordRateLimit('openrouter', model, retryAfter, err.message);
            logger.warn(`[LLMRouter] OpenRouter model ${model} rate limited, trying next model...`);
            continue;
          }
          rateLimitMonitor.recordFailure('openrouter', model);
          logger.error(`[LLMRouter] OpenRouter error with ${model}: ${err.message}`);
        }
      }
    }

    // 2. Try Gemini (if available)
    if (this.shouldUseProvider('gemini')) {
      try {
        const response = await this.geminiBreaker.fire(opts);
        rateLimitMonitor.recordSuccess('gemini', opts.model);
        return response;
      } catch (err: any) {
        lastError = err;
        rateLimitMonitor.recordFailure('gemini', opts.model);
        logger.error(`[LLMRouter] Gemini error: ${err.message}`);
      }
    }

    // 3. Final Fallback to Groq
    let groqModel = '';
    if (this.shouldUseProvider('groq')) {
      try {
        groqModel = this.mapToGroqModel(tier);
        const response = await this.groqBreaker.fire({ ...opts, model: groqModel });
        rateLimitMonitor.recordSuccess('groq', groqModel);
        return response;
      } catch (err: any) {
        const isRateLimit = err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit');
        if (isRateLimit) {
          const retryAfter = this.extractRetryAfter(err.message);
          rateLimitMonitor.recordRateLimit('groq', groqModel, retryAfter);
          logger.warn(`[LLMRouter] Groq rate limited: ${err.message}. Model: ${groqModel}. Retry in ${retryAfter}s`);
        } else {
          rateLimitMonitor.recordFailure('groq', groqModel);
          logger.error(`[LLMRouter] Groq error (${groqModel}): ${err.message}`);
        }
        lastError = err;
      }
    }

    // --- Critical Exhaustion ---
    logger.error({ tier, lastError: lastError?.message }, '[LLMRouter] All providers exhausted for reasoning task.');
    
    // 4. Local fallback
    const response = await this.local.call(opts);
    return response;
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

  private shouldUseProvider(providerName: string): boolean {
    switch (providerName) {
      case 'openrouter':
        return Boolean(process.env.OPENROUTER_API_KEY);
      case 'groq':
        return Boolean(process.env.GROQ_API_KEY);
      case 'gemini':
        return Boolean(process.env.GEMINI_API_KEY);
      default:
        return false;
    }
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

  private extractRetryAfter(errorMessage: string): number {
    // Try to extract retry-after from error message
    const retryMatch = errorMessage.match(/retry-after:?\s*(\d+)/i);
    if (retryMatch) {
      return parseInt(retryMatch[1], 10);
    }
    // Default retry after 60 seconds
    return 60;
  }
}

// --- Provider Health Check Endpoint ---
import express from 'express';
export const llmHealthRouter = express.Router();
llmHealthRouter.get('/health', async (req, res) => {
  res.json({
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    local: true,
    timestamp: Date.now()
  });
});

export const llmRouter = new LLMRouter();