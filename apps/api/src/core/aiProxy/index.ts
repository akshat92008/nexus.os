// apps/api/src/core/aiProxy/index.ts
import { checkRateLimit } from './tracking/rateLimit.js';
import { logUsageAndCalculateCost } from './tracking/usage.js';
import { getSystemPrompt } from './config/prompts.js';
import { optimizePrompt } from './utils/optimization.js';
import { executeWithFallback } from './router.js';

export interface CallAIParams {
  userId: string;
  taskType: string;
  prompt: string;
  metadata?: Record<string, any>;
}

export interface CallAIResponse {
  success: boolean;
  data: string;
  modelUsed: string;
  tokensUsed: number;
  cost: number;
  fallbackUsed: boolean;
  error?: string;
}

/**
 * THE ONLY ENTRY POINT FOR LLM CALLS
 */
export async function callAI({ userId, taskType, prompt, metadata }: CallAIParams): Promise<CallAIResponse> {
  try {
    // 1. Business-level Rate Limiting
    await checkRateLimit(userId);

    // 2. Prompt Optimization
    const systemPrompt = getSystemPrompt(taskType);
    const optimizedPrompt = optimizePrompt(prompt, 8000); // hard cap context length

    // 3. Route & Execute with Fallback Chain
    const aiResult = await executeWithFallback(taskType, systemPrompt, optimizedPrompt);

    if (aiResult.modelUsed === 'system_fallback') {
      throw new Error('All AI providers failed');
    }

    // 4. Validate output format for specific tasks
    if (taskType === 'lead_scoring') {
      try {
        JSON.parse(aiResult.content);
      } catch {
        throw new Error('LLM returned invalid JSON for lead_scoring — check model and prompt');
      }
    }

    if (taskType === 'email_drafting') {
      if (!aiResult.content || aiResult.content.trim().length < 10) {
        throw new Error('LLM returned empty or too-short email draft — retry');
      }
    }

    // 5. Usage & Cost Tracking
    const cost = await logUsageAndCalculateCost({
      userId,
      taskType,
      modelIdentifier: aiResult.modelUsed,
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens
    });

    // 6. Return Standardized Response
    return {
      success: true,
      data: aiResult.content,
      modelUsed: aiResult.modelUsed,
      tokensUsed: aiResult.promptTokens + aiResult.completionTokens,
      cost,
      fallbackUsed: aiResult.fallbackUsed
    };

  } catch (error: any) {
    // Handle Rate Limit specifically
    if (error.message.includes('limit reached') || error.message.includes('slow down')) {
      return {
        success: false,
        data: error.message,
        modelUsed: 'none',
        tokensUsed: 0,
        cost: 0,
        fallbackUsed: false,
        error: 'RATE_LIMIT_EXCEEDED'
      };
    }

    // Catch-all graceful error
    console.error(`[callAI Error] Task: ${taskType}, User: ${userId} -`, error.message);
    return {
      success: false,
      data: "An error occurred while processing the AI request.",
      modelUsed: 'none',
      tokensUsed: 0,
      cost: 0,
      fallbackUsed: false,
      error: error.message
    };
  }
}
