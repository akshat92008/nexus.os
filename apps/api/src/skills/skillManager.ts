/**
 * Nexus OS — Skill Manager
 * Extensible skills system inspired by OpenClaw
 * Manages skill discovery, installation, and execution
 */
import { logger } from '../logger.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { eventBus } from '../events/eventBus.js';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { pitchCoach } from './pitchCoach.js';
import { revenueEngine } from './revenueEngine.js';
import { competitorIntel } from './competitorIntel.js';
import { hiringEngine } from './hiringEngine.js';
import { legalGuard } from './legalGuard.js';
import { gtmStrategist } from './gtmStrategist.js';

export type SkillSource = 'bundled' | 'workspace' | 'installed' | 'npm';

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  source: SkillSource;
  type: 'system' | 'custom' | 'integration';
  
  // Tool definitions
  tools: SkillToolDefinition[];
  
  // Configuration
  config: {
    schema: Record<string, ConfigSchema>;
    defaults: Record<string, any>;
  };
  
  // Runtime
  runtime: {
    entrypoint?: string;
    language?: 'typescript' | 'javascript' | 'python' | 'rust';
    sandbox?: {
      enabled: boolean;
      image?: string;
      mounts?: string[];
    };
  };
  
  // Dependencies
  dependencies?: {
    skills?: string[];
    npm?: Record<string, string>;
    apt?: string[];
    python?: string[];
  };
  
  // Permissions
  permissions: {
    filesystem: string[];
    network: boolean;
    shell: boolean;
    envVars: string[];
  };
  
  // Metadata
  metadata: {
    tags: string[];
    category: string;
    icon?: string;
    color?: string;
    minNexusVersion?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface ConfigSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: any;
  required?: boolean;
  enum?: any[];
  secret?: boolean;
}

export interface SkillToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: string;
  returnType?: string;
}

export interface SkillInstance {
  id: string;
  manifest: SkillManifest;
  config: Record<string, any>;
  status: 'inactive' | 'active' | 'error';
  installedAt: Date;
  lastUsedAt?: Date;
  useCount: number;
  errorCount: number;
  errors: Array<{ message: string; timestamp: Date }>;
}

export interface SkillRegistry {
  skills: Map<string, SkillInstance>;
  toolMap: Map<string, { skillId: string; toolId: string }>;
}

export interface FounderSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  [key: string]: any;
}

class SkillManager {
  private registry: SkillRegistry = {
    skills: new Map(),
    toolMap: new Map()
  };
  private founderSkills: Map<string, FounderSkill> = new Map();
  private handlers: Map<string, Function> = new Map();
  private workspacePath: string;
  private skillsPath: string;

  constructor() {
    this.workspacePath = process.env.NEXUS_WORKSPACE || path.join(process.cwd(), 'workspace');
    this.skillsPath = path.join(this.workspacePath, 'skills');
  }

  async initialize() {
    logger.info('[SkillManager] Initializing skill system...');
    
    // Ensure workspace skills directory
    try {
      await fs.mkdir(this.skillsPath, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    // Load bundled skills
    await this.loadBundledSkills();
    
    // Load workspace skills
    await this.loadWorkspaceSkills();
    
    // Load installed skills from database
    await this.loadInstalledSkills();

    // Founder skills
    [pitchCoach, revenueEngine, competitorIntel, hiringEngine, legalGuard, gtmStrategist]
      .forEach(skill => this.registerFounderSkill(skill));

    // Subscribe to events
    eventBus.subscribe('skill_install_request', this.handleInstallRequest.bind(this));

    logger.info(`[SkillManager] Loaded ${this.registry.skills.size} skills`);
  }

  async loadBundledSkills() {
    const bundledDir = path.join(process.cwd(), 'src', 'skills', 'bundled');
    
    try {
      const entries = await fs.readdir(bundledDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(bundledDir, entry.name, 'skill.json');
          try {
            const manifestData = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestData) as SkillManifest;
            await this.registerSkill(manifest, 'bundled');
          } catch (err) {
            logger.warn(`[SkillManager] Failed to load bundled skill: ${entry.name}`);
          }
        }
      }
    } catch (err) {
      logger.warn('[SkillManager] No bundled skills directory found');
    }
  }

  async loadWorkspaceSkills() {
    try {
      const entries = await fs.readdir(this.skillsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(this.skillsPath, entry.name, 'skill.json');
          try {
            const manifestData = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestData) as SkillManifest;
            await this.registerSkill(manifest, 'workspace');
          } catch (err) {
            logger.warn(`[SkillManager] Failed to load workspace skill: ${entry.name}`);
          }
        }
      }
    } catch (err) {
      logger.warn('[SkillManager] No workspace skills found');
    }
  }

  async loadInstalledSkills() {
    const supabase = await getSupabase();
    const { data: skills } = await supabase
      .from('installed_skills')
      .select('*')
      .eq('status', 'active');

    for (const data of skills || []) {
      const manifest = data.manifest as SkillManifest;
      await this.registerSkill(manifest, 'installed', data.config || {});
    }
  }

  registerFounderSkill(skill: FounderSkill) {
    this.founderSkills.set(skill.id, skill);
    logger.info(`[SkillManager] Registered founder skill: ${skill.name}`);
  }

  async registerSkill(manifest: SkillManifest, source: SkillSource, userConfig: Record<string, any> = {}) {
    const id = manifest.id || randomUUID();
    
    // Merge config with defaults
    const config = {
      ...manifest.config.defaults,
      ...userConfig
    };

    const instance: SkillInstance = {
      id,
      manifest,
      config,
      status: 'active',
      installedAt: new Date(),
      useCount: 0,
      errorCount: 0,
      errors: []
    };

    this.registry.skills.set(id, instance);

    // Register tools
    for (const tool of manifest.tools) {
      const globalToolId = `${id}:${tool.id}`;
      this.registry.toolMap.set(tool.name, { skillId: id, toolId: tool.id });
      
      // Load handler
      await this.loadToolHandler(instance, tool);
    }

    logger.info(`[SkillManager] Registered skill: ${manifest.name} (${source})`);
  }

  async loadToolHandler(instance: SkillInstance, tool: SkillToolDefinition) {
    const skillPath = instance.manifest.source === 'bundled'
      ? path.join(process.cwd(), 'src', 'skills', 'bundled', instance.manifest.id)
      : path.join(this.skillsPath, instance.manifest.id);

    const handlerPath = path.join(skillPath, tool.handler);
    
    try {
      // Dynamic import for TypeScript/JavaScript handlers
      const module = await import(handlerPath + '.js');
      const handler = module.default || module[tool.handler.replace(/\.(ts|js)$/, '')];
      
      if (typeof handler === 'function') {
        this.handlers.set(`${instance.id}:${tool.id}`, handler);
      }
    } catch (err) {
      logger.warn(`[SkillManager] Failed to load handler for ${tool.name}: ${err}`);
    }
  }

  async executeTool(toolName: string, params: Record<string, any>, context?: any): Promise<any> {
    const toolRef = this.registry.toolMap.get(toolName);
    if (!toolRef) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const instance = this.registry.skills.get(toolRef.skillId);
    if (!instance) {
      throw new Error(`Skill not found: ${toolRef.skillId}`);
    }

    if (instance.status !== 'active') {
      throw new Error(`Skill ${instance.manifest.name} is not active`);
    }

    const handler = this.handlers.get(`${toolRef.skillId}:${toolRef.toolId}`);
    if (!handler) {
      throw new Error(`Handler not found for tool: ${toolName}`);
    }

    instance.useCount++;
    instance.lastUsedAt = new Date();

    try {
      // Validate permissions
      await this.validatePermissions(instance, params);

      // Execute with timeout
      const result = await Promise.race([
        handler(params, {
          config: instance.config,
          context,
          manifest: instance.manifest
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tool execution timeout')), 30000)
        )
      ]);

      return result;
    } catch (err) {
      instance.errorCount++;
      instance.errors.push({
        message: (err as Error).message,
        timestamp: new Date()
      });
      throw err;
    }
  }

  private async validatePermissions(instance: SkillInstance, params: Record<string, any>) {
    const perms = instance.manifest.permissions;

    // Check filesystem access
    if (params.filePath || params.directory) {
      const requestedPath = params.filePath || params.directory;
      const allowed = perms.filesystem.some(allowedPath => 
        requestedPath.startsWith(allowedPath.replace('*', ''))
      );
      
      if (!allowed) {
        throw new Error(`Filesystem access denied: ${requestedPath}`);
      }
    }

    // Check network access
    if (params.url && !perms.network) {
      throw new Error('Network access denied for this skill');
    }

    // Check shell access
    if (params.command && !perms.shell) {
      throw new Error('Shell execution denied for this skill');
    }
  }

  async installSkill(source: string, options?: { 
    url?: string; 
    npmPackage?: string;
    config?: Record<string, any>;
  }): Promise<SkillInstance> {
    logger.info(`[SkillManager] Installing skill from: ${source}`);

    let manifest: SkillManifest;

    if (source.endsWith('.json')) {
      // Local manifest file
      const data = await fs.readFile(source, 'utf-8');
      manifest = JSON.parse(data);
    } else if (options?.npmPackage) {
      // NPM package
      manifest = await this.installFromNpm(options.npmPackage);
    } else if (options?.url) {
      // Remote URL
      manifest = await this.installFromUrl(options.url);
    } else {
      throw new Error('Invalid skill source');
    }

    // Validate manifest
    this.validateManifest(manifest);

    // Install dependencies
    await this.installDependencies(manifest);

    // Store in database
    const supabase = await getSupabase();
    await supabase.from('installed_skills').insert({
      id: manifest.id,
      manifest,
      config: options?.config || {},
      status: 'active',
      installed_at: new Date().toISOString()
    });

    // Register
    await this.registerSkill(manifest, 'installed', options?.config);

    logger.info(`[SkillManager] Installed skill: ${manifest.name}`);
    
    return this.registry.skills.get(manifest.id)!;
  }

  async uninstallSkill(skillId: string) {
    const instance = this.registry.skills.get(skillId);
    if (!instance) return;

    // Remove tool registrations
    for (const tool of instance.manifest.tools) {
      this.registry.toolMap.delete(tool.name);
      this.handlers.delete(`${skillId}:${tool.id}`);
    }

    this.registry.skills.delete(skillId);

    // Remove from database
    const supabase = await getSupabase();
    await supabase
      .from('installed_skills')
      .delete()
      .eq('id', skillId);

    logger.info(`[SkillManager] Uninstalled skill: ${instance.manifest.name}`);
  }

  getTools(): Array<{ name: string; description: string; parameters: any }> {
    const tools: Array<{ name: string; description: string; parameters: any }> = [];
    
    for (const [_, instance] of this.registry.skills) {
      if (instance.status !== 'active') continue;
      
      for (const tool of instance.manifest.tools) {
        tools.push({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        });
      }
    }

    return tools;
  }

  getSkills(): Array<SkillInstance | FounderSkill> {
    return [...Array.from(this.registry.skills.values()), ...Array.from(this.founderSkills.values())];
  }

  getSkill(id: string): SkillInstance | FounderSkill | undefined {
    return this.registry.skills.get(id) || this.founderSkills.get(id);
  }

  private async installFromNpm(packageName: string): Promise<SkillManifest> {
    // Would use npm/pnpm to install and extract manifest
    throw new Error('NPM installation not yet implemented');
  }

  private async installFromUrl(url: string): Promise<SkillManifest> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch skill from URL: ${response.statusText}`);
    }
    return await response.json();
  }

  private async installDependencies(manifest: SkillManifest) {
    if (manifest.dependencies?.npm) {
      // Install npm dependencies
      logger.info(`[SkillManager] Installing npm dependencies for ${manifest.name}`);
    }
    
    if (manifest.dependencies?.python) {
      // Install python dependencies
      logger.info(`[SkillManager] Installing python dependencies for ${manifest.name}`);
    }
  }

  private validateManifest(manifest: SkillManifest) {
    if (!manifest.id) throw new Error('Skill manifest missing id');
    if (!manifest.name) throw new Error('Skill manifest missing name');
    if (!manifest.tools) throw new Error('Skill manifest missing tools');
    if (!manifest.permissions) throw new Error('Skill manifest missing permissions');
  }

  private async handleInstallRequest(event: any) {
    const { source, options } = event;
    try {
      await this.installSkill(source, options);
    } catch (err) {
      logger.error({ err }, '[SkillManager] Skill installation failed');
    }
  }
}

export const skillManager = new SkillManager();
