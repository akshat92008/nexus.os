import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../logger.js';
import { skillBus } from './skillBus.js';

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  tools: Array<{
    name: string;
    description: string;
    parameters: any;
  }>;
}

class SkillManager {
  private skills = new Map<string, SkillManifest>();

  async initialize() {
    logger.info('[SkillManager] Initializing skill system...');
    
    // 1. Auto-discover bundled skill folders
    const bundledDir = path.join(process.cwd(), 'src/skills/bundled');
    try {
      const skillDirs = await fs.readdir(bundledDir, { withFileTypes: true });

      for (const dir of skillDirs.filter(d => d.isDirectory())) {
        const manifestPath = path.join(bundledDir, dir.name, 'skill.json');
        try {
          const manifest: SkillManifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
          await this.registerSkill(manifest, path.join(bundledDir, dir.name));
          logger.info({ skill: manifest.id }, '[SkillManager] Registered bundled skill');
        } catch (err: any) {
          logger.warn({ skill: dir.name, err: err.message }, '[SkillManager] Skill registration failed');
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, '[SkillManager] Failed to read bundled skills directory');
    }

    // 2. Register "founder skills" (stubs for now as requested in 3.1)
    const founderSkills = ['pitchCoach', 'revenueEngine', 'competitorIntel', 'hiringEngine', 'legalGuard', 'gtmStrategist'];
    for (const skillId of founderSkills) {
      this.registerInMemorySkill({
        id: skillId,
        name: skillId,
        description: `Nexus OS ${skillId} System`,
        version: '1.0.0',
        tools: []
      });
    }
  }

  async registerSkill(manifest: SkillManifest, dirPath: string) {
    this.skills.set(manifest.id, manifest);
    
    // Register tools in skillBus
    for (const tool of manifest.tools) {
      skillBus.register(tool.name, async (params, ctx) => {
        return this.executeTool(tool.name, params, ctx);
      });
    }
  }

  registerInMemorySkill(manifest: SkillManifest) {
    this.skills.set(manifest.id, manifest);
  }

  async executeTool(toolName: string, params: any, ctx: any) {
    logger.info({ toolName, params }, '[SkillManager] Executing tool');
    // Actual tool execution logic would go here
    const result = { success: true, data: `Executed ${toolName}` };
    
    await this.runPostHooks(toolName, result, ctx);
    return result;
  }

  private async runPostHooks(toolName: string, result: any, ctx: any) {
    // Phase 3.3: Notion/Trello + Calendar sync
    if ((toolName === 'notion_create_page' || toolName === 'trello_create_card') && result.dueDate) {
      if (skillBus.has('calendar_create_event')) {
        await skillBus.call('calendar_create_event', {
          title: result.title,
          date: result.dueDate,
          description: `Auto-created from ${toolName}`,
        }, ctx).catch(err => logger.warn({ err }, '[SkillManager] Calendar hook failed'));
      }
    }
  }
}

export const skillManager = new SkillManager();
