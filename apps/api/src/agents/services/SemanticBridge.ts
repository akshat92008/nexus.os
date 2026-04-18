/**
 * Nexus OS — Semantic Bridge (Context Compression Engine)
 *
 * This module addresses "Context Saturation" by digesting raw agent
 * artifacts into a structured "Mission World-State" or "Briefing".
 */

import type { TaskNode, MemoryEntry } from '@nexus-os/types';

import { 
  MODEL_POWER 
} from '../agentConfig.js';
import { llmRouter } from '../../llm/LLMRouter.js';

export interface MissionWorldState {
  summary: string;
  keyInsights: Array<{ insight: string; source: string }>;
  verifiedData: Record<string, any>;
  unresolvedGaps: string[];
  suggestedFocus: string;
}

export class SemanticBridge {
  private readonly MAX_CONTEXT_ITEMS = 5;      
  private readonly RELEVANCE_THRESHOLD = 0.65; 
  private readonly MAX_TOKENS_PER_DEP = 2000;  
  private readonly MAX_TOTAL_CONTEXT = 8000;   

  private windowMemory(artifacts: MemoryEntry[]): { 
    working: MemoryEntry[]; 
    summarized: MemoryEntry[];
  } {
    const sorted = [...artifacts].sort((a, b) => b.writtenAt - a.writtenAt);
    const working = sorted.slice(0, this.MAX_CONTEXT_ITEMS);
    const summarized = sorted.slice(this.MAX_CONTEXT_ITEMS);
    return { working, summarized };
  }

  async synthesizeBriefing(
    goal: string,
    artifacts: MemoryEntry[],
    targetTask: TaskNode
  ): Promise<string> {
    console.log(`[SemanticBridge] ⚡ Synthesizing briefing for Task: ${targetTask.id}...`);

    if (artifacts.length === 0) return 'No prior context available. Start from scratch.';

    const { working, summarized } = this.windowMemory(artifacts);
    const relevantWorking = working.filter((e) => targetTask.contextFields.includes(e.taskId));
    
    // FETCH CROSS-MISSION CONTEXT (Long-Term Memory)
    let longTermMemory = '';
    try {
      const { vectorStore } = await import('../../storage/vectorStore.js');
      const neighbors = await vectorStore.search(goal, 3);
      if (neighbors.length > 0) {
        longTermMemory = neighbors.map(n => `(Historical Similarity: ${(n as any).similarity.toFixed(2)}) ${n.content}`).join('\n\n');
      }
    } catch (err) {
      console.warn('[SemanticBridge] Semantic retrieval skipped:', (err as any).message);
    }

    const workingContext = relevantWorking
      .map((e) => {
        const rawData = JSON.stringify(e.data);
        const limitedData = rawData.length > this.MAX_TOKENS_PER_DEP * 4 
          ? rawData.slice(0, this.MAX_TOKENS_PER_DEP * 4) + '... [TRUNCATED]'
          : rawData;
        return `[Task: ${e.taskId}] (${e.agentType}): ${limitedData}`;
      })
      .join('\n\n');

    let archiveSummary = '';
    if (summarized.length > 0) {
      archiveSummary = await this.summarizeOldContext(goal, summarized);
    }

    let finalWorkingContext = workingContext;
    if (finalWorkingContext.length > this.MAX_TOTAL_CONTEXT * 4) {
      finalWorkingContext = finalWorkingContext.slice(0, this.MAX_TOTAL_CONTEXT * 4) + '... [TOTAL CONTEXT LIMIT REACHED]';
    }

    if (!finalWorkingContext && !archiveSummary && !longTermMemory) return 'No directly relevant prior context found for this task.';

    const prompt = `
      You are the NexusOS Semantic Bridge. 
      MISSION GOAL: "${goal}"
      TARGET TASK: "${targetTask.label}"
      --- CROSS-MISSION MEMORY (Historical Semantic Context) ---
      ${longTermMemory || 'No relevant historical context.'}
      --- ARCHIVED MISSION CONTEXT (Summarized) ---
      ${archiveSummary || 'None.'}
      --- RECENT WORKING MEMORY (Raw) ---
      ${workingContext || 'None.'}
      REASONING TASK:
      1. Review raw findings and historical memory.
      2. Identify core truths and patterns.
      3. Connect dots between current and past work.
      4. Synthesize a high-density operational briefing.
      Respond ONLY with the Markdown-formatted briefing text.
    `;

    try {
      const res = await llmRouter.call({
        system: 'You are a master information synthesizer.',
        user: prompt,
        model: MODEL_POWER,
        temperature: 0.1,
        maxTokens: 1000,
      });

      return res.content;
    } catch (err) {
      console.error('[SemanticBridge] Briefing synthesis failed:', err);
      return workingContext;
    }
  }

  private async summarizeOldContext(goal: string, artifacts: MemoryEntry[]): Promise<string> {
    const context = artifacts
      .map((e) => `[Task: ${e.taskId}] (${e.agentType}): ${JSON.stringify(e.data).slice(0, 500)}`)
      .join('\n\n');

    const prompt = `
      Summarize mission artifacts for the goal: "${goal}".
      Extract ONLY facts and Conclusions.
      Format: Dense Markdown list.
      ARCHIVED DATA:
      ${context}
    `;

    try {
      const res = await llmRouter.call({
        system: 'Summarize mission artifacts.',
        user: prompt,
        model: MODEL_POWER,
        temperature: 0.0,
        maxTokens: 800,
      });

      return res.content;
    } catch (err) {
      console.error('[SemanticBridge] Summarization failed:', err);
      return 'Archived context summary unavailable.';
    }
  }
}

export const semanticBridge = new SemanticBridge();
