/**
 * NexusOS — Agent Registry
 * 
 * Central registry for all available AI agents in the OS ecosystem.
 * Defines agent capabilities, permissions, and metadata.
 */

import type { AgentType } from '@nexus-os/types';
import type { BaseAgentDriver } from './BaseAgentDriver.js';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  category: 'productivity' | 'business' | 'learning' | 'finance' | 'creative' | 'technical';
  icon: string; // Lucide icon name
  capabilities: string[];
  permissions: string[];
  version: string;
  author: string;
  isBuiltIn: boolean;
  costPerTask?: number; // Estimated credits or USD
  driver?: BaseAgentDriver; // Optional dynamic driver
}

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  'researcher-standard': {
    id: 'researcher-standard',
    name: 'Standard Researcher',
    description: 'Specializes in fact-finding, data gathering, and source verification.',
    type: 'researcher',
    category: 'research' as any,
    icon: 'Search',
    capabilities: ['web_search', 'data_extraction', 'fact_checking'],
    permissions: ['internet_access'],
    version: '1.0.0',
    author: 'Nexus Core',
    isBuiltIn: true,
  },
  'analyst-standard': {
    id: 'analyst-standard',
    name: 'Market Analyst',
    description: 'Expert in SWOT analysis, trend detection, and data synthesis.',
    type: 'analyst',
    category: 'business',
    icon: 'Activity',
    capabilities: ['swot_analysis', 'trend_prediction', 'risk_assessment'],
    permissions: ['read_files'],
    version: '1.0.0',
    author: 'Nexus Core',
    isBuiltIn: true,
  },
  'writer-pro': {
    id: 'writer-pro',
    name: 'Pro Copywriter',
    description: 'Generates high-quality prose, emails, and technical documentation.',
    type: 'writer',
    category: 'creative',
    icon: 'PenTool',
    capabilities: ['copywriting', 'creative_writing', 'editing'],
    permissions: ['write_files'],
    version: '1.1.0',
    author: 'Nexus Core',
    isBuiltIn: true,
  },
  'coder-engineer': {
    id: 'coder-engineer',
    name: 'Software Engineer',
    description: 'Writes clean, documented, and tested code in multiple languages.',
    type: 'coder',
    category: 'technical',
    icon: 'Code',
    capabilities: ['typescript', 'python', 'unit_testing', 'debugging'],
    permissions: ['file_system_write', 'cli_execution'],
    version: '2.0.0',
    author: 'Nexus Core',
    isBuiltIn: true,
  },
  'strategist-biz': {
    id: 'strategist-biz',
    name: 'Business Strategist',
    description: 'Builds roadmaps, go-to-market plans, and growth strategies.',
    type: 'strategist',
    category: 'business',
    icon: 'Target',
    capabilities: ['roadmap_generation', 'gtm_strategy', 'revenue_modeling'],
    permissions: ['read_financials'],
    version: '1.0.0',
    author: 'Nexus Core',
    isBuiltIn: true,
  }
};

/**
 * Register a new Agent at runtime (Ecosystem SDK)
 */
export function registerAgent(definition: AgentDefinition): void {
  console.log(`[AgentRegistry] 🦾 Registering neural unit: ${definition.id} (${definition.name})`);
  AGENT_REGISTRY[definition.id] = definition;
}

/**
 * Retrieves an agent definition by its ID.
 */
export function getAgentDefinition(id: string): AgentDefinition | undefined {
  return AGENT_REGISTRY[id];
}

/**
 * Lists all agents in a specific category.
 */
export function listAgentsByCategory(category: AgentDefinition['category']): AgentDefinition[] {
  return Object.values(AGENT_REGISTRY).filter(a => a.category === category);
}

/**
 * Finds the best agent for a given AgentType (used by the orchestrator).
 */
export function findBestAgentForType(type: AgentType): AgentDefinition {
  const matches = Object.values(AGENT_REGISTRY).filter(a => a.type === type);
  return matches[0] || AGENT_REGISTRY['researcher-standard'];
}
