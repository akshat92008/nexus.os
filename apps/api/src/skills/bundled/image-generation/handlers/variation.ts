import { promises as fs } from 'fs';
import path from 'path';
import FormData from 'form-data';

interface VariationParams {
  image_path: string;
  n?: number;
  output_dir?: string;
}

export default async function variation(params: VariationParams): Promise<any> {
  const { image_path, n = 1, output_dir = '/tmp' } = params;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY required');

  const form = new FormData();
  form.append('image', await fs.readFile(image_path), path.basename(image_path));
  form.append('n', String(Math.min(n, 4)));
  form.append('size', '1024x1024');

  const response = await fetch('https://api.openai.com/v1/images/variations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form as any
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI variation error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const images = data.data || [];

  const results: Array<{ url: string; path: string }> = [];

  for (let i = 0; i < images.length; i++) {
    const url = images[i].url;
    const imgResponse = await fetch(url);
    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    const outPath = path.join(output_dir, `variation-${Date.now()}-${i}.png`);
    await fs.writeFile(outPath, buffer);
    results.push({ url, path: outPath });
  }

  return { success: true, count: results.length, images: results };
}
