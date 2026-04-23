/**
 * Nexus OS — Council of Three (Consensus Engine)
 *
 * Pattern: two LLM calls in parallel at different temperatures, then a
 * judge call that synthesises the best answer from both responses.
 */

import { LLMRouter } from '../src/llm/LLMRouter.js';
import { logger } from '../src/logger.js';

const JUDGE_SYSTEM = `You are a critical synthesis judge. You receive two draft responses to the same prompt.
Your job is to produce ONE final answer that takes the strongest elements from each draft.
Rules:
- Do not mention "Draft A" or "Draft B" in your final output.
- Do not add preamble like "Here is the synthesised answer".
- Output ONLY the final answer text. Nothing else.`;

/**
 * Run the Council of Three consensus pattern.
 *
 * @param prompt   The user's question or task description
 * @param context  Optional additional context injected into the system prompt
 * @param config   Optional token configuration (Hardening Fix 1)
 * @returns        The judge-synthesised answer as a plain string
 */
export async function runConsensus(prompt: string, context = '', config?: any): Promise<string> {
  const router = new LLMRouter();

  // 🚨 FIX 1: Robust token limit fallback
  const tokenLimit = (typeof config?.token?.limit === 'number' && config.token.limit > 0)
    ? config.token.limit
    : 1500;

  const systemPrompt = context
    ? `You are a helpful expert assistant.\n\nContext:\n${context}`
    : 'You are a helpful expert assistant.';

  try {
    // ── Step 1: Two parallel drafts ──────────────────────────────────────────
    const [draftA, draftB] = await Promise.all([
      router.call({
        user: prompt,
        system: systemPrompt,
        temperature: 0.4,
        model: 'MODEL_POWER',
        maxTokens: tokenLimit
      }),
      router.call({
        user: prompt,
        system: systemPrompt,
        temperature: 0.7,
        model: 'MODEL_POWER',
        maxTokens: tokenLimit
      }),
    ]);

    const textA = (draftA.content || '').trim();
    const textB = (draftB.content || '').trim();

    // ── Step 2: Judge synthesises ────────────────────────────────────────────
    const judgePrompt = `Original prompt:\n"${prompt}"\n\nDraft A:\n${textA}\n\nDraft B:\n${textB}\n\nSynthesize the single best answer.`;

    const judgedResponse = await router.call({
      user: judgePrompt,
      system: JUDGE_SYSTEM,
      temperature: 0.2,
      model: 'MODEL_POWER',
      maxTokens: tokenLimit
    });

    // 🚨 FIX 2: Mismatched consensus function interface safety
    const results = Array.isArray(judgedResponse) ? judgedResponse : [judgedResponse];
    return (results[0].content || '').trim();

  } catch (error) {
    logger.error({ prompt, err: (error as any).message }, 'Consensus aggregator failed');
    throw error;
  }
}
