// REQUIRES: form-data, file upload via fetch
import { createReadStream } from 'fs';
import FormData from 'form-data';

export default async function transcribe(params: { audio_path: string; model?: string; language?: string; prompt?: string }): Promise<any> {
  const { audio_path, model = 'whisper-1', language, prompt } = params;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const form = new FormData();
  form.append('file', createReadStream(audio_path));
  form.append('model', model);
  if (language) form.append('language', language);
  if (prompt) form.append('prompt', prompt);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form as any
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Whisper API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return { success: true, text: data.text, language: data.language || language || 'auto' };
}
