import { promises as fs } from 'fs';
import path from 'path';

interface GenerateParams {
  prompt: string;
  size?: string;
  quality?: string;
  style?: string;
  output_path?: string;
  provider?: string;
}

export default async function generate(params: GenerateParams): Promise<any> {
  const { prompt, size = '1024x1024', quality = 'standard', style = 'vivid', output_path, provider = 'openai' } = params;

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY required for OpenAI image generation');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        size,
        quality,
        style,
        n: 1
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI image error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    const revisedPrompt = data.data?.[0]?.revised_prompt;

    if (!imageUrl) throw new Error('No image URL returned');

    // Download image
    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    const outPath = output_path || path.join('/tmp', `generated-${Date.now()}.png`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, buffer);

    return {
      success: true,
      url: imageUrl,
      output_path: outPath,
      size: buffer.length,
      revised_prompt: revisedPrompt
    };
  }

  throw new Error(`Provider ${provider} not yet supported`);
}
