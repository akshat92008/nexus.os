/**
 * Nexus OS — Semantic Bridge (Context Compression Engine)
 *
 * This module addresses "Context Saturation" by digesting raw agent
 * artifacts into a structured "Mission World-State" or "Briefing".
 */

import type { TaskNode, MemoryEntry } from '../../../packages/types/index.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const POWER_MODEL = 'llama-3.3-70b-versatile';

export interface MissionWorldState {
  summary: string;
  keyInsights: Array<{ insight: string; source: string }>;
  verifiedData: Record<string, any>;
  unresolvedGaps: string[];
  suggestedFocus: string;
}

export class SemanticBridge {
  private readonly MAX_CONTEXT_ITEMS = 5;      // Only keep the last 5 artifacts in working memory
  private readonly RELEVANCE_THRESHOLD = 0.65; // Similarity threshold for context retrieval

  /**
   * Memory Windowing: Identifies which artifacts should be in Working vs Summarized memory.
   */
  private windowMemory(artifacts: MemoryEntry[]): { 
    working: MemoryEntry[]; 
    summarized: MemoryEntry[];
  } {
    // 1. Sort by recency (assuming MemoryEntry has a writtenAt or similar timestamp)
    const sorted = [...artifacts].sort((a, b) => b.writtenAt - a.writtenAt);
    
    // 2. Window: First N are "Working", rest are "Summarized"
    const working = sorted.slice(0, this.MAX_CONTEXT_ITEMS);
    const summarized = sorted.slice(this.MAX_CONTEXT_ITEMS);

    return { working, summarized };
  }

  /**
   * Synthesizes all prior artifacts into a structured World-State briefing.
   */
  async synthesizeBriefing(
    goal: string,
    artifacts: MemoryEntry[],
    targetTask: TaskNode
  ): Promise<string> {
    console.log(`[SemanticBridge] ⚡ Synthesizing briefing for Task: ${targetTask.id}...`);

    if (artifacts.length === 0) return 'No prior context available. Start from scratch.';

    // 1. Memory Windowing
    const { working, summarized } = this.windowMemory(artifacts);

    // 2. Filter Working Memory for directly requested fields
    const relevantWorking = working.filter((e) => targetTask.contextFields.includes(e.taskId));
    
    const workingContext = relevantWorking
      .map((e) => `[Task: ${e.taskId}] (${e.agentType}): ${JSON.stringify(e.data).slice(0, 1000)}`)
      .join('\n\n');

    // 3. Summarize Archived Memory if any
    let archiveSummary = '';
    if (summarized.length > 0) {
      archiveSummary = await this.summarizeOldContext(goal, summarized);
    }

    if (!workingContext && !archiveSummary) return 'No directly relevant prior context found for this task.';

    const prompt = `
      You are the NexusOS Semantic Bridge.
      MISSION GOAL: "${goal}"
      TARGET TASK: "${targetTask.label}" (Agent: ${targetTask.agentType})

      --- ARCHIVED MISSION CONTEXT (Summarized) ---
      ${archiveSummary || 'None.'}

      --- RECENT WORKING MEMORY (Raw) ---
      ${workingContext || 'None.'}

      REASONING TASK:
      1. Review the raw findings from recent agents AND the archived mission summary.
      2. Identify the core "Mission Truths" and "Verified Data" that are relevant to the TARGET TASK.
      3. Connect the dots: How does the "Market Trend" from the archive relate to the "Technical Constraint" from recent tasks?
      4. Synthesize a high-density "OPERATIONAL BRIEFING" for the next agent.

      Respond ONLY with the Markdown-formatted briefing text. No conversational preamble.
    `;

    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: POWER_MODEL,
          messages: [{ role: 'system', content: 'You are a master information synthesizer.' }, { role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      });

      if (!res.ok) throw new Error(`Groq API Error: ${res.status}`);
      const data = await res.json() as any;
      const briefing = data.choices[0].message.content;

      console.log(`[SemanticBridge] Briefing generated (${briefing.length} chars).`);
      return briefing;
    } catch (err) {
      console.error('[SemanticBridge] Briefing synthesis failed, falling back to raw context:', err);
      return workingContext;
    }
  }

  /**
   * Compresses old context into a single dense summary to save tokens.
   */
  private async summarizeOldContext(goal: string, artifacts: MemoryEntry[]): Promise<string> {
    console.log(`[SemanticBridge] 📦 Summarizing ${artifacts.length} archived artifacts...`);
    
    const context = artifacts
      .map((e) => `[Task: ${e.taskId}] (${e.agentType}): ${JSON.stringify(e.data).slice(0, 500)}`)
      .join('\n\n');

    const prompt = `
      Summarize the following archived mission artifacts for the goal: "${goal}".
      Extract ONLY the high-value facts, data points, and conclusions.
      Format as a dense Markdown list.
      
      ARCHIVED DATA:
      ${context}
    `;

    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: POWER_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.0,
        }),
      });
      const data = await res.json() as any;
      return data.choices[0].message.content;
    } catch (err) {
      console.error('[SemanticBridge] Summarization failed:', err);
      return 'Archived context summary unavailable.';
    }
  }
}

export const semanticBridge = new SemanticBridge();
