import { ILLMProvider, LLMCallOpts, LLMResponse } from './ILLMProvider.js';

/**
 * Nexus OS — GeminiProvider
 *
 * Implementation of ILLMProvider for Google Gemini API.
 */
export class GeminiProvider implements ILLMProvider {
  private readonly GEMINI_FAST_MODEL = 'gemini-2.0-flash-exp';
  private readonly GEMINI_POWER_MODEL = 'gemini-1.5-pro';

  async call(opts: LLMCallOpts): Promise<LLMResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    // Map Groq-style models to Gemini models if necessary
    const model = this.mapToGeminiModel(opts.model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${opts.system}\n\n${opts.user}` }],
        },
      ],
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
        ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });

    if (response.status === 429) {
      throw new Error('429 Too Many Requests [Gemini]');
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await response.json()) as any;
    
    if (data.error) {
      throw new Error(`Gemini API Error: ${data.error.message}`);
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[No output]';
    
    // Gemini 1.5/2.0 returns usage metadata
    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const candidatesTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = promptTokens + candidatesTokens;

    return {
      content,
      tokens: totalTokens,
    };
  }

  private mapToGeminiModel(groqModel: string): string {
    const isPower = groqModel.includes('70b') || groqModel.includes('synthesis') || groqModel.includes('mixtral');
    return isPower ? this.GEMINI_POWER_MODEL : this.GEMINI_FAST_MODEL;
  }
}
