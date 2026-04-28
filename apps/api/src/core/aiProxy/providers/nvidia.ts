// apps/api/src/core/aiProxy/providers/nvidia.ts
import { AIProvider, AIResponse } from './base.js';

export class NvidiaProvider implements AIProvider {
  name = 'nvidia';

  async generate(modelId: string, system: string, prompt: string, maxTokens: number): Promise<AIResponse> {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 1,
        top_p: 0.95,
        extra_body: {
          chat_template_kwargs: {
            thinking: false
          }
        }
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`NVIDIA Error: ${res.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await res.json() as any;
    
    return {
      content: data.choices[0].message.content,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens
    };
  }
}
