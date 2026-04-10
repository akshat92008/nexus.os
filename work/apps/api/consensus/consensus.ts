/**
 * Nexus OS — Council of Three (Consensus Engine)
 *
 * Pattern: two LLM calls in parallel at different temperatures, then a
 * judge call that synthesises the best answer from both responses.
 *
 *  Draft A  (temp 0.4 — precise, conservative)
 *  Draft B  (temp 0.7 — creative, exploratory)
 *       ↓
 *  Judge    (temp 0.2 — analytical, picks the best and merges)
 *       ↓
 *  Final answer (string)
 */

import { LLMRouter } from '../src/llm/LLMRouter.js';

const router = new LLMRouter();

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
 * @returns        The judge-synthesised answer as a plain string
 */
export async function runConsensus(prompt: string, context = ''): Promise<string> {
  const systemPrompt = context
    ? `You are a helpful expert assistant.\n\nContext:\n${context}`
    : 'You are a helpful expert assistant.';

  // ── Step 1: Two parallel drafts ──────────────────────────────────────────
  const [draftA, draftB] = await Promise.all([
    router.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.4, tier: 'MODEL_POWER', systemPrompt }
    ),
    router.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, tier: 'MODEL_POWER', systemPrompt }
    ),
  ]);

  const textA = draftA.content.trim();
  const textB = draftB.content.trim();

  // ── Step 2: Judge synthesises ────────────────────────────────────────────
  const judgePrompt = `Original prompt:\n"${prompt}"\n\nDraft A:\n${textA}\n\nDraft B:\n${textB}\n\nSynthesize the single best answer.`;

  const judged = await router.chat(
    [{ role: 'user', content: judgePrompt }],
    { temperature: 0.2, tier: 'MODEL_POWER', systemPrompt: JUDGE_SYSTEM }
  );

  return judged.content.trim();
}
