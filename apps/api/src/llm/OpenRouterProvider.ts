import { ILLMProvider, LLMCallOpts, LLMResponse } from './ILLMProvider.js';

/**
 * Nexus OS — OpenRouterProvider
 *
 * Implementation of ILLMProvider for OpenRouter API (OpenAI-compatible).
 */
export class OpenRouterProvider implements ILLMProvider {
  private readonly API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly HARD_TOKEN_LIMIT = 4096;

  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const appName = 'Nexus OS';

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not set');
    }

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': appUrl,
        'X-Title': appName,
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature,
        max_tokens: Math.min(opts.maxTokens, this.HARD_TOKEN_LIMIT),
        stream: opts.enableStreaming ?? false,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
      signal: opts.signal,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`429 Too Many Requests${retryAfter ? ` retry-after: ${retryAfter}` : ''}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API ${response.status}: ${errText.slice(0, 200)}`);
    }

    // Handle streaming response
    if (opts.enableStreaming && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
      let totalTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              const delta = data?.choices?.[0]?.delta;
              
              if (delta?.content) {
                const text = delta.content;
                content += text;
                if (opts.onStreamChunk) opts.onStreamChunk(text);
              }

              // OpenRouter sometimes provides usage in the last chunk
              if (data?.usage) {
                totalTokens = (data.usage.completion_tokens ?? 0) + (data.usage.prompt_tokens ?? 0);
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return {
        content,
        tokens: totalTokens,
      };
    }

    // Non-streaming response
    const data = (await response.json()) as any;
    const content = data?.choices?.[0]?.message?.content ?? '[No output]';
    const totalTokens = (data?.usage?.total_tokens ?? 0);

    return {
      content,
      tokens: totalTokens,
    };
  }
}
