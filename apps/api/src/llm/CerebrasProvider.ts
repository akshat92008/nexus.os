import { ILLMProvider, LLMCallOpts, LLMResponse } from './ILLMProvider.js';

/**
 * Nexus OS — CerebrasProvider
 *
 * Implementation of ILLMProvider for Cerebras API (OpenAI-compatible).
 * Cerebras offers extremely fast inference for Llama 3 models.
 */
export class CerebrasProvider implements ILLMProvider {
  private readonly API_URL = 'https://api.cerebras.ai/v1/chat/completions';
  
  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    const apiKey = process.env.CEREBRAS_API_KEY;

    if (!apiKey) {
      throw new Error('CEREBRAS_API_KEY not set');
    }

    let response: Response;
    try {
      response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          temperature: opts.temperature ?? 0.1,
          max_tokens: opts.maxTokens ?? 2048,
          stream: false, // Currently only supporting non-streaming for Cerebras parity
          ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.user },
          ],
        }),
        signal: opts.signal,
      });
    } catch (err: any) {
      console.error('[Cerebras] Fetch failure:', err.message);
      throw new Error(`Cerebras Service Unavailable: ${err.message}`);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`429 Too Many Requests Cerebras${retryAfter ? ` retry-after: ${retryAfter}` : ''}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cerebras API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await response.json()) as any;
    const content = data?.choices?.[0]?.message?.content ?? '[No output]';
    const usage = data?.usage?.total_tokens ?? 0;

    return {
      content,
      tokens: usage,
    };
  }
}
