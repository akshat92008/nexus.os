import { skillRuntime, type SkillExecutionResult } from './skillRuntime.js';

export interface ExternalSkill {
  id?: string;
  name: string;
  scriptPath?: string;
  requires_approval: boolean;
  undoScriptPath?: string;
}

/**
 * Backward-compatible adapter for legacy callers.
 * Prefer `runRegisteredSkill` for new code so skills resolve through
 * the manifest-driven runtime instead of raw script paths.
 */
export async function runExternalSkill(skill: ExternalSkill, params: Record<string, unknown>) {
  const skillId = skill.id || deriveSkillId(skill);
  const result = await skillRuntime.executeSkill(skillId, params);

  if (!result.success) {
    throw new Error(result.error || `Skill "${skillId}" failed`);
  }

  return result.data;
}

export async function runRegisteredSkill(
  skillId: string,
  params: Record<string, unknown>
): Promise<SkillExecutionResult> {
  return skillRuntime.executeSkill(skillId, params);
}

function deriveSkillId(skill: ExternalSkill): string {
  if (skill.scriptPath?.includes('openclaw_calendar')) {
    return 'openclaw_calendar_sync';
  }

  return skill.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
