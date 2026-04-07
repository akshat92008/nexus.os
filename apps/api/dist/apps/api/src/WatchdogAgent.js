/**
 * Nexus OS — Watchdog Agent (Runtime Safety & Logical Audit)
 *
 * This module addresses "Logical Drift" by periodically auditing
 * the MissionMemory against the original mission goal.
 */
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const POWER_MODEL = 'llama-3.3-70b-versatile';
export class WatchdogAgent {
    intervals = new Map();
    /**
     * Starts monitoring a specific mission.
     */
    startMonitoring(missionId, goal, memory, onDriftDetected) {
        console.log(`[Watchdog] 🛡️ Monitoring Mission: ${missionId}...`);
        const interval = setInterval(async () => {
            const artifacts = memory.readAll();
            if (artifacts.length === 0)
                return;
            const recentContext = artifacts
                .slice(-3)
                .map((art) => `[Task: ${art.taskId}] Result: ${JSON.stringify(art.data).slice(0, 300)}...`)
                .join('\n\n');
            const prompt = `
        You are the NexusOS Watchdog Auditor.
        MISSION GOAL: "${goal}"
        
        RECENT MISSION PROGRESS:
        ${recentContext}

        AUDIT TASK:
        1. Is the current progress still logically aligned with the MISSION GOAL?
        2. Are there any internal contradictions between these recent findings?
        3. Is the agent "drifting" into irrelevant details or circular reasoning?

        Respond ONLY with a JSON object:
        {
          "status": "safe" | "drift_detected" | "contradiction_detected",
          "reason": "your explanation if status is not safe"
        }
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
                    return;
                const data = await res.json();
                const audit = JSON.parse(data.choices[0].message.content);
                if (audit.status !== 'safe') {
                    console.warn(`[Watchdog] ⚠️  ALARM: ${audit.status.toUpperCase()} - ${audit.reason}`);
                    onDriftDetected(audit.reason);
                }
            }
            catch (err) {
                // Silently fail
            }
        }, 30000);
        this.intervals.set(missionId, interval);
    }
    /**
     * Stops monitoring a mission.
     */
    stopMonitoring(missionId) {
        const interval = this.intervals.get(missionId);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(missionId);
            console.log(`[Watchdog] 🛑 Stopped monitoring: ${missionId}`);
        }
    }
}
export const watchdogAgent = new WatchdogAgent();
//# sourceMappingURL=WatchdogAgent.js.map