import { ILLMProvider, LLMCallOpts, LLMResponse } from './ILLMProvider.js';
import { GROQ_API_URL } from '../agents/agentConfig.js';

/**
 * Nexus OS — GroqProvider
 *
 * Implementation of ILLMProvider for Groq API.
 */
export class GroqProvider implements ILLMProvider {
  private readonly HARD_TOKEN_LIMIT = 4000;

  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
      throw new Error(`Groq API ${response.status}: ${errText.slice(0, 200)}`);
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
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              const delta = data?.choices?.[0]?.delta;
              const finishReason = data?.choices?.[0]?.finish_reason;

              if (delta?.content) {
                const text = delta.content;
                content += text;
                if (opts.onStreamChunk) opts.onStreamChunk(text);
              }

              if (finishReason === 'stop' && data?.usage) {
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
    const totalTokens = (data?.usage?.completion_tokens ?? 0) + (data?.usage?.prompt_tokens ?? 0);

    return {
      content,
      tokens: totalTokens,
    };
  }
}
