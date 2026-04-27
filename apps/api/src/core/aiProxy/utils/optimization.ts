// apps/api/src/core/aiProxy/utils/optimization.ts
/**
 * Trims prompt to prevent massive context window blowouts.
 * 1 token ≈ 4 characters. We leave a 10% buffer.
 */
export function optimizePrompt(prompt: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * 4 * 0.9);
  if (prompt.length > maxChars) {
    return prompt.slice(0, maxChars) + '... [TRUNCATED]';
  }
  return prompt;
}
