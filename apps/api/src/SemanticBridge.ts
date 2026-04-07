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

    const relevantEntries = artifacts.filter((e) => targetTask.contextFields.includes(e.taskId));
    
    const rawContext = relevantEntries
      .map((e) => `[Task: ${e.taskId}] (${e.agentType}): ${JSON.stringify(e.data).slice(0, 1000)}`)
      .join('\n\n');

    if (!rawContext) return 'No directly relevant prior context found for this task.';

    const prompt = `
      You are the NexusOS Semantic Bridge.
      MISSION GOAL: "${goal}"
      TARGET TASK: "${targetTask.label}" (Agent: ${targetTask.agentType})

      RAW AGENT ARTIFACTS:
      ${rawContext}

      REASONING TASK:
      1. Review the raw findings from previous agents.
      2. Identify the core "Mission Truths" and "Verified Data" that are relevant to the TARGET TASK.
      3. Connect the dots: How does the "Market Trend" from Task A relate to the "Technical Constraint" from Task B?
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
      return rawContext;
    }
  }
}

export const semanticBridge = new SemanticBridge();
