import { mkdir, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { SkillRuntime } from '../tools/skillRuntime.js';

async function createTempSkillRuntime() {
  const root = await mkdir(path.join(os.tmpdir(), `nexus-skill-${Date.now()}`), { recursive: true });

  await writeFile(
    path.join(root, 'echo_counter.js'),
    [
      'const fs = require("fs");',
      'const path = require("path");',
      'const params = JSON.parse(process.argv[2] || "{}");',
      'const counterPath = path.join(process.cwd(), "counter.txt");',
      'let count = 0;',
      'if (fs.existsSync(counterPath)) count = Number(fs.readFileSync(counterPath, "utf8") || "0");',
      'count += 1;',
      'fs.writeFileSync(counterPath, String(count));',
      'console.log(JSON.stringify({ echoed: params.message || null, count }));',
    ].join('\n'),
    'utf8'
  );

  await writeFile(
    path.join(root, 'echo_counter.skill.json'),
    JSON.stringify(
      {
        id: 'echo_counter',
        name: 'Echo Counter',
        description: 'Echoes a message and increments a counter.',
        entry: 'echo_counter.js',
        runtime: 'node',
        inputMode: 'argv-json',
        outputMode: 'json',
        requiresApproval: false,
        cacheTtlMs: 60_000,
        timeoutMs: 5_000,
        tags: ['test'],
        undo: { strategy: 'none' },
      },
      null,
      2
    ),
    'utf8'
  );

  return { runtime: new SkillRuntime(root), root };
}

describe('SkillRuntime', () => {
  it('loads manifests from disk and executes a registered skill', async () => {
    const { runtime } = await createTempSkillRuntime();

    const skills = await runtime.listSkills();
    expect(skills.map((skill) => skill.id)).toContain('echo_counter');

    const result = await runtime.executeSkill('echo_counter', { message: 'hello' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ echoed: 'hello', count: 1 });
  });

  it('returns cached results for repeated calls when cacheTtlMs is set', async () => {
    const { runtime } = await createTempSkillRuntime();

    const first = await runtime.executeSkill('echo_counter', { message: 'same' });
    const second = await runtime.executeSkill('echo_counter', { message: 'same' });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect((first.data as any).count).toBe(1);
    expect((second.data as any).count).toBe(1);
    expect(second.cached).toBe(true);
  });
});
