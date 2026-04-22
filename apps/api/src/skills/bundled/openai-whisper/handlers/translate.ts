import { createReadStream } from 'fs';
import FormData from 'form-data';

export default async function translate(params: { audio_path: string }): Promise<any> {
  const { audio_path } = params;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const form = new FormData();
  form.append('file', createReadStream(audio_path));
  form.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/translations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form as any
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Whisper API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return { success: true, text: data.text };
}
