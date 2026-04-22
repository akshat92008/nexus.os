import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';

const execFileAsync = promisify(execFile);

export default async function speak(params: { text: string; voice?: string; speed?: number; provider?: string; output_path?: string }): Promise<any> {
  const { text, voice = 'Alex', speed = 1.0, provider = 'macos', output_path } = params;

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tts-1',
        voice: (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice) ? voice : 'alloy'),
        input: text,
        speed
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`TTS API error: ${error.error?.message || response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const outPath = output_path || `/tmp/tts-${Date.now()}.mp3`;
    await fs.writeFile(outPath, buffer);

    // Play if macOS
    if (!output_path) {
      await execFileAsync('afplay', [outPath]);
      await fs.unlink(outPath);
    }

    return { success: true, provider: 'openai', output_path: output_path || null, bytes: buffer.length };
  }

  // macOS say command
  if (output_path) {
    await execFileAsync('say', ['-v', voice, '-o', output_path, text]);
    return { success: true, provider: 'macos', output_path };
  }

  await execFileAsync('say', ['-v', voice, '-r', String(Math.round(160 * speed)), text]);
  return { success: true, provider: 'macos', spoken: true };
}
