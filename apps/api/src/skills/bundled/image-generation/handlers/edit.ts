import { promises as fs } from 'fs';
import path from 'path';
import FormData from 'form-data';

interface EditParams {
  image_path: string;
  mask_path?: string;
  prompt: string;
  output_path?: string;
}

export default async function edit(params: EditParams): Promise<any> {
  const { image_path, mask_path, prompt, output_path } = params;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY required');

  const form = new FormData();
  form.append('image', await fs.readFile(image_path), path.basename(image_path));
  form.append('prompt', prompt);
  if (mask_path) {
    form.append('mask', await fs.readFile(mask_path), path.basename(mask_path));
  }

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form as any
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI edit error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;

  if (!imageUrl) throw new Error('No image returned');

  const imageResponse = await fetch(imageUrl);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  const outPath = output_path || path.join('/tmp', `edited-${Date.now()}.png`);
  await fs.writeFile(outPath, buffer);

  return { success: true, url: imageUrl, output_path: outPath, size: buffer.length };
}
