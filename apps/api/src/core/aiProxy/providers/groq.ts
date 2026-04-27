// apps/api/src/core/aiProxy/providers/groq.ts
import { AIProvider, AIResponse } from './base.js';

export class GroqProvider implements AIProvider {
  name = 'groq';

  async generate(modelId: string, system: string, prompt: string, maxTokens: number): Promise<AIResponse> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages:[
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });

    if (!res.ok) throw new Error(`Groq Error: ${res.statusText}`);
    const data = await res.json();
    
    return {
      content: data.choices[0].message.content,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens
    };
  }
}
