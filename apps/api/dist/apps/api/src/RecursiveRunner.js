/**
 * Nexus OS — Recursive Runner (Fractal Task Decomposition)
 *
 * This module addresses the "Complexity Scaling" problem by spawning
 * sub-orchestrators for complex tasks.
 */
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const POWER_MODEL = 'llama-3.3-70b-versatile';
export class RecursiveRunner {
    /**
     * Identifies if a task needs fractal decomposition.
     */
    isComplex(task) {
        return task.priority === 'critical' || task.label.toLowerCase().includes('build a full') || task.label.toLowerCase().includes('comprehensive');
    }
    /**
     * Spawns a sub-orchestrator for a complex task.
     */
    async decompose(parentTask, parentGoal, contextBriefing) {
        console.log(`[RecursiveRunner] 🧩 Decomposing Complex Task: ${parentTask.id}...`);
        const prompt = `
      You are the NexusOS Recursive Planner.
      PARENT GOAL: "${parentGoal}"
      TARGET COMPLEX TASK: "${parentTask.label}" (Agent: ${parentTask.agentType})
      
      CONTEXT FROM PRIOR TASKS:
      ${contextBriefing}

      REASONING TASK:
      1. Break this complex task into 3-5 atomic "Micro-Tasks".
      2. Each micro-task should be specialized and dependent on each other if needed.
      3. Create a valid TaskDAG for this sub-mission.

      REQUIRED JSON STRUCTURE:
      {
        "missionId": "sub_${parentTask.id}",
        "goal": "${parentTask.label}",
        "goalType": "analysis",
        "nodes": [
          {
            "id": "micro_1",
            "label": "First atomic step",
            "agentType": "researcher",
            "dependencies": [],
            "contextFields": [],
            "expectedOutput": { "format": "prose" }
          }
        ]
      }

      Respond ONLY with the JSON object.
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
                    response_format: { type: 'json_object' },
                    temperature: 0.1,
                }),
            });
            if (!res.ok)
                throw new Error(`Groq API Error: ${res.status}`);
            const data = await res.json();
            const subDag = JSON.parse(data.choices[0].message.content);
            console.log(`[RecursiveRunner] Decomposed into ${subDag.nodes.length} micro-tasks.`);
            return subDag;
        }
        catch (err) {
            console.error('[RecursiveRunner] Decomposition failed, falling back to single execution:', err);
            throw err;
        }
    }
    /**
     * Merges results from a sub-DAG into a single artifact.
     */
    synthesizeResults(subArtifacts) {
        return subArtifacts
            .map((art) => `[Micro-Task: ${art.taskId}] ${JSON.stringify(art.data).slice(0, 500)}`)
            .join('\n\n---\n\n');
    }
}
export const recursiveRunner = new RecursiveRunner();
//# sourceMappingURL=RecursiveRunner.js.map