import { ILLMProvider, LLMCallOpts, LLMResponse } from './ILLMProvider.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { GroqProvider } from './GroqProvider.js';
import { rateLimitMonitor } from './RateLimitMonitor.js';
import { createBreaker } from '../circuitBreaker.js';
import { withRetry } from '../resilience.js';
import { logger } from '../logger.js';
import { CerebrasProvider } from './CerebrasProvider.js';
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
    const content = (data as any).candidates?.[0]?.content?.parts?.[0]?.text || '[Gemini: No response]';
    
    // Extract usage metadata for billing/metrics (Ticket 3)
    const usage = (data as any).usageMetadata ? {
      promptTokens: (data as any).usageMetadata.promptTokenCount ?? 0,
      completionTokens: (data as any).usageMetadata.candidatesTokenCount ?? 0,
    } : { promptTokens: 0, completionTokens: 0 };

    return { 
      content, 
      tokens: usage.promptTokens + usage.completionTokens
    };
  }
}
class LocalProvider {
  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    const errorMsg = 'No external LLM providers available (All exhausted or rate-limited).';
    const content = JSON.stringify({ 
      error: errorMsg,
      status: 'ok', // Mocking a safe status for JSON-parsers
      reasoning: 'Fallback to local memory.'
    });
    return { 
      content, 
      tokens: 0 
    };
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
    'google/gemini-2.0-flash-lite-preview-02-05:free',
    'google/gemini-2.0-flash:free',
    'meta-llama/llama-3.3-70b-instruct:free', 
    'meta-llama/llama-3.2-3b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free', 
    'deepseek/deepseek-chat:free',
    'sophosympatheia/rogue-rose-103b-v0.2:free',
  ], 
  [MODEL_POWER]: [ 
    'meta-llama/llama-3.3-70b-instruct:free', 
    'deepseek/deepseek-r1:free', 
    'qwen/qwen-2.5-72b-instruct:free', 
    'deepseek/deepseek-chat:free', // V3
    'google/gemini-2.0-pro-exp-02-05:free',
    'sophosympatheia/rogue-rose-103b-v0.2:free',
  ], 
  [MODEL_CODE]: [ 
    'qwen/qwen-2.5-coder-32b-instruct:free', 
    'deepseek/deepseek-r1:free', 
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.1-70b-instruct:free',
  ], 
  [MODEL_VISION]: [ 
    'google/gemini-2.0-flash-lite-preview-02-05:free',
    'meta-llama/llama-3.2-11b-vision-instruct:free', 
  ], 
};

export class LLMRouter {
  private openRouter: ILLMProvider;
  private groqFallback: ILLMProvider;
  private gemini: ILLMProvider;
  private cerebras: ILLMProvider;
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
  private cerebrasBreaker: ReturnType<typeof createBreaker>;
  private groqBreaker: ReturnType<typeof createBreaker>;

  constructor() {
    this.openRouter = new OpenRouterProvider();
    this.groqFallback = new GroqProvider();
    this.gemini = new GeminiProvider();
    this.cerebras = new CerebrasProvider();
    this.local = new LocalProvider();

    // Initialize circuit breakers ONCE at construction
    this.openRouterBreaker = createBreaker((args: LLMCallOpts) => this.openRouter.call(args));
    this.geminiBreaker = createBreaker((args: LLMCallOpts) => this.gemini.call(args));
    this.cerebrasBreaker = createBreaker((args: LLMCallOpts) => this.cerebras.call(args));
    this.groqBreaker = createBreaker((args: LLMCallOpts) => this.groqFallback.call(args));
  }

  /**
   * Main entry point for LLM calls with tier-based routing and rotation.
   * If all rotation attempts fail, falls back to Groq.
   */
  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    // 0. Context Compression Middleware
    if (opts.user.length > 25000) {
      logger.info(`[LLMRouter] 🗜️ Compressing large user context (${opts.user.length} chars)...`);
      try {
        const summary = await this.call({
          system: 'Summarize the following agent findings concisely, preserving all key metrics, names, and strategic decisions. Output a bulleted list.',
          user: opts.user.slice(0, 50000), 
          model: MODEL_FAST,
          maxTokens: 1200,
          temperature: 0.3,
        });
        opts.user = `[SUMMARY OF PRIOR CONTEXT]\n${summary.content}\n\n[LATEST CONTEXT]\n${opts.user.slice(-8000)}`;
      } catch (err) {
        logger.warn({ err }, '[LLMRouter] Context compression failed, proceeding with truncated text');
        opts.user = opts.user.slice(0, 25000);
      }
    }

    const tier = this.resolveTier(opts.model);
    const providers = this.getProviderChain(tier, opts);
    let lastError: any;

    for (const providerInfo of providers) {
      const { name, model, breaker } = providerInfo;
      
      // Skip if explicitly rate limited in monitor
      if (rateLimitMonitor.isRateLimited(name, model)) continue;

      // Skip if health is too low (< 20) unless we are desperate
      if (rateLimitMonitor.getHealthScore(name, model) < 20 && providers.indexOf(providerInfo) < providers.length - 1) {
        continue;
      }

      try {
        const response = await breaker.fire({ ...opts, model });
        rateLimitMonitor.recordSuccess(name, model);
        return response;
      } catch (err: any) {
        lastError = err;
        const isRateLimit = err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit');
        
        if (isRateLimit) {
          const retryAfter = this.extractRetryAfter(err.message);
          rateLimitMonitor.recordRateLimit(name, model, retryAfter, err.message);
          logger.warn(`[LLMRouter] ${name} (${model}) rate limited, trying next in chain...`);
        } else {
          rateLimitMonitor.recordFailure(name, model);
          logger.error(`[LLMRouter] ${name} error with ${model}: ${err.message}`);
        }
      }
    }

    // --- Critical Exhaustion ---
    logger.error({ tier, lastError: lastError?.message }, '[LLMRouter] ALL PROVIDERS EXHAUSTED.');
    return await this.local.call(opts);
  }

  private getProviderChain(tier: string, opts: LLMCallOpts): any[] {
    const chain: any[] = [];
    const openRouterModels = (FREE_MODELS as any)[tier] || [opts.model];
    
    // Choose rotation index for OpenRouter
    const orIdx = this.rotationIndices[tier] || 0;
    const orModel = openRouterModels[orIdx];
    this.rotationIndices[tier] = (orIdx + 1) % openRouterModels.length;

    // Build the candidates
    const candidates = [
      { name: 'cerebras', model: this.mapToCerebrasModel(tier), breaker: this.cerebrasBreaker, enabled: this.shouldUseProvider('cerebras') },
      { name: 'openrouter', model: orModel, breaker: this.openRouterBreaker, enabled: this.shouldUseProvider('openrouter') },
      { name: 'gemini', model: 'gemini-1.5-flash', breaker: this.geminiBreaker, enabled: this.shouldUseProvider('gemini') },
      { name: 'groq', model: this.mapToGroqModel(tier), breaker: this.groqBreaker, enabled: this.shouldUseProvider('groq') },
    ].filter(p => p.enabled);

    // DYNAMIC SORTING
    candidates.sort((a, b) => {
      // 1. Explicit Preference
      if (opts.preferProvider === a.name) return -1;
      if (opts.preferProvider === b.name) return 1;

      // 2. Health Score
      const hA = rateLimitMonitor.getHealthScore(a.name, a.model);
      const hB = rateLimitMonitor.getHealthScore(b.name, b.model);
      if (Math.abs(hA - hB) > 30) return hB - hA;

      // 3. Tier/Capacity logic
      if (tier === MODEL_POWER || opts.user.length > 10000) {
        // Power/Big Context favors Gemini > Cerebras > OR > Groq
        const weights: any = { groq: 100, gemini: 80, cerebras: 60, openrouter: 40 };
        return (weights[b.name] || 0) - (weights[a.name] || 0);
      } else {
        // Fast tasks favor Groq > Gemini > Cerebras > OR
        const weights: any = { groq: 100, gemini: 80, cerebras: 60, openrouter: 40 };
        return (weights[b.name] || 0) - (weights[a.name] || 0);
      }
    });

    return candidates;
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
      case 'cerebras':
        const hasKey = Boolean(process.env.CEREBRAS_API_KEY);
        if (!hasKey) logger.info('[LLMRouter] Skipping Cerebras provider: CEREBRAS_API_KEY not set.');
        return hasKey;
      default:
        return false;
    }
  }

  private mapToCerebrasModel(tier: string): string {
    switch (tier) {
      case MODEL_POWER:
      case MODEL_CODE:
        return 'llama3.1-70b';
      case MODEL_FAST:
      default:
        return 'llama3.1-8b';
    }
  }

  private mapToGroqModel(tier: string): string {
    switch (tier) {
      case MODEL_POWER:
      case MODEL_CODE:
        return 'llama-3.3-70b-versatile';
      case MODEL_FAST:
      default:
        return 'llama-3.1-8b-instant';
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
export const llmHealthRouter: express.Router = express.Router();
llmHealthRouter.get('/health', async (req, res) => {
  res.json({
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    cerebras: Boolean(process.env.CEREBRAS_API_KEY),
    local: true,
    timestamp: Date.now()
  });
});

export const llmRouter = new LLMRouter();