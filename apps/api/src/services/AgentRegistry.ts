import { getSupabase } from '../storage/supabaseClient.js';
import { getRedis } from '../storage/redisClient.js';
import { Queue } from 'bullmq';
import { logger } from '../logger.js';

/**
 * AgentRegistry
 * 
 * Manages the persistence of custom agents in Supabase and their 
 * lifecycle in the BullMQ task scheduler.
 */
export class AgentRegistry {
  private queue: Queue | null = null;

  private async getQueue() {
    if (this.queue) return this.queue;
    
    const redis = getRedis();
    // BullMQ needs a raw ioredis instance or connection opts
    // Since getRedis() returns a ResilientRedis wrapper, we access the underlying client if available
    const connection = (redis as any).client || process.env.REDIS_URL;
    
    this.queue = new Queue('scheduled_agents', { 
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
      }
    });
    return this.queue;
  }

  /**
   * Saves an agent to the database and schedules it if a cron expression is present.
   */
  async saveAgent(agent: {
    user_id: string;
    name: string;
    trigger_type: 'manual' | 'cron' | 'event';
    cron_expression?: string;
    dag_payload: any;
  }) {
    logger.info({ agentName: agent.name }, '💾 Saving new Custom Agent');
    
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('saved_agents')
      .insert([agent])
      .select()
      .single();

    if (error) throw new Error(`Failed to save agent: ${error.message}`);

    // If it has a cron schedule, register it with BullMQ
    if (agent.trigger_type === 'cron' && agent.cron_expression) {
      await this.scheduleAgent(data.id, agent.name, agent.cron_expression, agent.dag_payload);
    }

    return data;
  }

  /**
   * Registers a recurring job in BullMQ
   */
  private async scheduleAgent(agentId: string, name: string, cron: string, dagPayload: any) {
    logger.info({ name, cron }, '⏰ Scheduling Agent recurring mission');
    
    const q = await this.getQueue();
    await q.add(
      `run_agent_${agentId}`,
      { agentId, dagPayload, name },
      { 
        repeat: { pattern: cron },
        jobId: `cron_${agentId}` // Deterministic ID to avoid duplication
      }
    );
  }

  /**
   * Removes an agent's schedule from the queue
   */
  async removeSchedule(agentId: string) {
    const q = await this.getQueue();
    const repeatableJobs = await q.getRepeatableJobs();
    const job = repeatableJobs.find(j => j.id === `cron_${agentId}`);
    
    if (job) {
      await q.removeRepeatableByKey(job.key);
      logger.info({ agentId }, '🛑 Removed schedule for Agent');
    }
  }
}

export const agentRegistry = new AgentRegistry();
