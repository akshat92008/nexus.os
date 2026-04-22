import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TIMEOUT_MS = 20_000;

function resolveDefaultSkillsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../external_skills'),
    path.resolve(__dirname, '../../src/external_skills'),
    path.resolve(process.cwd(), 'src/external_skills'),
    path.resolve(process.cwd(), 'apps/api/src/external_skills'),
  ];

  const match = candidates.find((candidate) => existsSync(candidate));
  return match || candidates[0];
}

export const skillManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  entry: z.string().min(1),
  runtime: z.enum(['node']).default('node'),
  inputMode: z.enum(['argv-json']).default('argv-json'),
  outputMode: z.enum(['json']).default('json'),
  requiresApproval: z.boolean().default(false),
  cacheTtlMs: z.number().int().nonnegative().optional(),
  timeoutMs: z.number().int().positive().optional(),
  tags: z.array(z.string()).default([]),
  undo: z
    .object({
      strategy: z.enum(['none', 'script']).default('none'),
      entry: z.string().optional(),
    })
    .optional(),
});

export type SkillManifest = z.infer<typeof skillManifestSchema>;

export interface SkillExecutionResult {
  success: boolean;
  skillId: string;
  data?: unknown;
  error?: string;
  cached?: boolean;
  undo_params?: Record<string, unknown> | null;
  executedAt: string;
}

interface CachedSkillResult {
  expiresAt: number;
  value: SkillExecutionResult;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(',')}}`;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

export class SkillRuntime {
  private manifestCache = new Map<string, SkillManifest>();
  private resultCache = new Map<string, CachedSkillResult>();
  private skillsDir: string;

  constructor(skillsDir = resolveDefaultSkillsDir()) {
    this.skillsDir = skillsDir;
  }

  async listSkills(forceReload = false): Promise<SkillManifest[]> {
    if (!forceReload && this.manifestCache.size > 0) {
      return Array.from(this.manifestCache.values());
    }

    const entries = await readdir(this.skillsDir, { withFileTypes: true });
    const manifestFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.skill.json'))
      .map((entry) => path.join(this.skillsDir, entry.name));

    const manifests = await Promise.all(
      manifestFiles.map(async (manifestPath) => {
        const parsed = skillManifestSchema.parse(await readJsonFile(manifestPath));
        return parsed;
      })
    );

    this.manifestCache.clear();
    for (const manifest of manifests) {
      this.manifestCache.set(manifest.id, manifest);
    }

    return manifests;
  }

  async getSkill(skillId: string): Promise<SkillManifest | undefined> {
    const manifests = await this.listSkills();
    return manifests.find((manifest) => manifest.id === skillId);
  }

  async executeSkill(
    skillId: string,
    params: Record<string, unknown>,
    opts?: { bypassCache?: boolean }
  ): Promise<SkillExecutionResult> {
    const skill = await this.getSkill(skillId);
    if (!skill) {
      return {
        success: false,
        skillId,
        error: `Skill "${skillId}" not found.`,
        executedAt: new Date().toISOString(),
      };
    }

    const cacheKey = `${skillId}:${stableStringify(params)}`;
    if (!opts?.bypassCache && skill.cacheTtlMs && skill.cacheTtlMs > 0) {
      const cached = this.resultCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.value, cached: true };
      }
    }

    const entryPath = path.join(this.skillsDir, skill.entry);
    const timeoutMs = skill.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const executedAt = new Date().toISOString();

    try {
      const data = await this.runNodeSkill(entryPath, params, timeoutMs);
      const result: SkillExecutionResult = {
        success: true,
        skillId: skill.id,
        data,
        executedAt,
        undo_params:
          skill.undo?.strategy === 'script'
            ? {
                skillId: skill.id,
                undo_entry: skill.undo.entry,
                original_params: params,
              }
            : null,
      };

      if (skill.cacheTtlMs && skill.cacheTtlMs > 0) {
        this.resultCache.set(cacheKey, {
          expiresAt: Date.now() + skill.cacheTtlMs,
          value: result,
        });
      }

      return result;
    } catch (error: any) {
      logger.error({ skillId, err: error.message }, '[SkillRuntime] Skill execution failed');
      return {
        success: false,
        skillId: skill.id,
        error: error.message,
        executedAt,
      };
    }
  }

  private runNodeSkill(
    entryPath: string,
    params: Record<string, unknown>,
    timeoutMs: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [entryPath, JSON.stringify(params)], {
        cwd: path.dirname(entryPath),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Skill timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(stderr.trim() || `Skill exited with code ${code}`));
          return;
        }

        try {
          resolve(stdout.trim() ? JSON.parse(stdout) : {});
        } catch (err: any) {
          reject(new Error(`Invalid JSON returned by skill: ${err.message}`));
        }
      });
    });
  }
}

export const skillRuntime = new SkillRuntime();
