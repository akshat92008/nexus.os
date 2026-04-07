/**
 * NexusOS — Agent Registry
 *
 * Central registry for all available AI agents in the OS ecosystem.
 * Defines agent capabilities, permissions, and metadata.
 */
import type { AgentType } from '@nexus-os/types';
export interface AgentDefinition {
    id: string;
    name: string;
    description: string;
    type: AgentType;
    category: 'productivity' | 'business' | 'learning' | 'finance' | 'creative' | 'technical';
    icon: string;
    capabilities: string[];
    permissions: string[];
    version: string;
    author: string;
    isBuiltIn: boolean;
    costPerTask?: number;
}
export declare const AGENT_REGISTRY: Record<string, AgentDefinition>;
/**
 * Retrieves an agent definition by its ID.
 */
export declare function getAgentDefinition(id: string): AgentDefinition | undefined;
/**
 * Lists all agents in a specific category.
 */
export declare function listAgentsByCategory(category: AgentDefinition['category']): AgentDefinition[];
/**
 * Finds the best agent for a given AgentType (used by the orchestrator).
 */
export declare function findBestAgentForType(type: AgentType): AgentDefinition;
//# sourceMappingURL=agentRegistry.d.ts.map