import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../logger.js';
import { DagEngine } from '../orchestrator/DagEngine.js';

const REDIS_URL = process.env.REDIS_URL;
let connection: Redis | undefined;

if (REDIS_URL) {
  try {
    connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  } catch (err) {
    logger.error({ err }, '[AgentWorker] Redis connection failed');
  }
}

/**
 * Agent Worker
 * 
 * Specifically listens for 'scheduled_agents' jobs triggered by the cron registry.
 * It executes the DAG using the DagEngine in "silent mode" (logging only).
 */
export const agentWorker = connection ? new Worker(
  'scheduled_agents',
  async (job: Job) => {
    const { agentId, dagPayload, name } = job.data;
    
    logger.info({ agentId, name }, '⚡ WAKING UP AGENT FOR SCHEDULED MISSION');

    try {
      // Initialize the core engine with the saved payload
      const engine = new DagEngine({
        nodes: dagPayload.nodes || dagPayload, // Support both wrapped and direct payloads
        userId: 'system', // Tasks mapped to system account for scheduled jobs
        missionId: `scheduled_${agentId}_${Date.now()}`,
        goal: name || 'Scheduled Automation',
        onEvent: (event) => {
          // In a worker context, we pipe internal engine events to the logger
          if (event.type === 'agent_working') {
             logger.info({ agentId }, `[Scheduled Agent] ${event.message}`);
          }
          if (event.type === 'error') {
             logger.error({ agentId, error: event.message }, '[Scheduled Agent] Error in step');
          }
        }
      });
      
      // Execute the high-precision parallel graph
      const results = await engine.executeGraph();
      
      logger.info({ agentId }, '✅ Scheduled Agent completed successfully.');
      return results;
      
    } catch (error: any) {
      logger.error({ agentId, error: error.message }, '❌ Scheduled Agent Execution Failed');
      throw error;
    }
  },
  { 
    connection,
    concurrency: 2 // Allow processing 2 agents in parallel per worker instance
  }
) : null;

logger.info('[AgentWorker] Online and listening for scheduled missions...');
