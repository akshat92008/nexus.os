import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';

type RepeatJob = {
  id: string;
  key: string;
  name: string;
  data: any;
  repeat?: { pattern?: string };
};

class InProcessQueue {
  private jobs: RepeatJob[] = [];
  private repeatableJobs: RepeatJob[] = [];

  async add(name: string, data: any, opts: any = {}): Promise<RepeatJob> {
    const job: RepeatJob = {
      id: opts.jobId || randomUUID(),
      key: `${name}:${opts.jobId || 'job'}:${opts.repeat?.pattern || 'once'}`,
      name,
      data,
      repeat: opts.repeat,
    };

    if (opts.repeat) {
      this.repeatableJobs.push(job);
    } else {
      this.jobs.push(job);
    }

    return job;
  }

  async getRepeatableJobs(): Promise<RepeatJob[]> {
    return [...this.repeatableJobs];
  }

  async removeRepeatableByKey(key: string): Promise<void> {
    this.repeatableJobs = this.repeatableJobs.filter((job) => job.key !== key);
  }

  async getJobs(): Promise<RepeatJob[]> {
    return [...this.jobs];
  }

  async remove(jobId: string): Promise<void> {
    this.jobs = this.jobs.filter((job) => job.id !== jobId);
  }
}

const fallbackMissionsQueue = new InProcessQueue();
const fallbackTasksQueue = new InProcessQueue();
const fallbackSystemQueue = new InProcessQueue();

function buildConnection() {
  if (process.env.REDIS_URL) {
    return { connection: { url: process.env.REDIS_URL } as any };
  }

  return {
    connection: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || '6379'),
    },
  };
}

let missionsQueue: Queue | InProcessQueue = fallbackMissionsQueue;
let tasksQueue: Queue | InProcessQueue = fallbackTasksQueue;
let systemQueue: Queue | InProcessQueue = fallbackSystemQueue;

try {
  const options = buildConnection();
  missionsQueue = new Queue('missions', options as any);
  tasksQueue = new Queue('tasks', options as any);
  systemQueue = new Queue('system', options as any);
  logger.info('[Queue] BullMQ queues initialized');
} catch (err) {
  logger.warn({ err }, '[Queue] BullMQ unavailable, using in-process queues');
}

export { missionsQueue, tasksQueue, systemQueue };

