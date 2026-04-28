import type { Express, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { startDurableMission } from '../orchestrator.js';
import { eventBus } from '../events/eventBus.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import { toolExecutor } from '../tools/toolExecutor.js';
import { vectorStore } from '../storage/vectorStore.js';
import { searchDriver } from '../integrations/drivers/searchDriver.js';
import { channelManager, type ChannelConfig } from '../channels/channelManager.js';
import { logger } from '../logger.js';

type MemoryRecord = {
  id: string;
  userId: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
};

const fallbackMemories = new Map<string, MemoryRecord[]>();
const abortedMissions = new Set<string>();

function getUserMemories(userId: string): MemoryRecord[] {
  return fallbackMemories.get(userId) ?? [];
}

function scoreFallbackMemory(query: string, content: string): number {
  const q = query.toLowerCase();
  const text = content.toLowerCase();
  if (text === q) return 1;
  if (text.includes(q)) return 0.9;

  const queryTerms = q.split(/\s+/).filter(Boolean);
  const matched = queryTerms.filter((term) => text.includes(term)).length;
  return matched / Math.max(queryTerms.length, 1);
}

export function registerRuntimeRoutes(app: Express): void {
  app.post('/api/missions', async (req: Request, res: Response) => {
    try {
      const goal = String(req.body?.goal || '').trim();
      const goalType = typeof req.body?.goalType === 'string' ? req.body.goalType : 'general';

      if (!goal) {
        return res.status(400).json({ error: 'goal is required' });
      }

      const missionId = randomUUID();

      queueMicrotask(() => {
        void startDurableMission({
          goal,
          goalType,
          userId: req.user!.id,
          sessionId: missionId,
          isAborted: () => abortedMissions.has(missionId),
        }).catch((err) => {
          logger.error({ err, missionId }, '[RuntimeRoutes] Mission execution failed');
        });
      });

      return res.status(202).json({ missionId, status: 'queued' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/missions', async (req: Request, res: Response) => {
    try {
      const missions = await nexusStateStore.getActiveMissions().catch(() => []);
      res.json({ missions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/missions/:id', async (req: Request, res: Response) => {
    try {
      const mission = await nexusStateStore.getMissionById(req.params.id);
      const tasks = await nexusStateStore.getMissionTasks(req.params.id).catch(() => []);
      if (!mission) {
        return res.status(404).json({ error: 'Mission not found' });
      }
      res.json({ mission, tasks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/missions/:id/abort', async (req: Request, res: Response) => {
    abortedMissions.add(req.params.id);
    await eventBus.publish(req.params.id, {
      type: 'aborted',
      missionId: req.params.id,
      message: 'Mission marked for abortion',
    });
    res.json({ missionId: req.params.id, status: 'aborting' });
  });

  app.get('/api/missions/:id/stream', async (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', missionId: req.params.id })}\n\n`);

    const unsubscribe = await eventBus.subscribe(req.params.id, async (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
      res.end();
    });
  });

  app.post('/api/rollback', async (req: Request, res: Response) => {
    try {
      const missionId = String(req.body?.missionId || '').trim();
      if (!missionId) {
        return res.status(400).json({ error: 'missionId is required' });
      }

      const result = await toolExecutor.rollbackLast(missionId);
      res.json(result.error ? result : { status: 'success', result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/skills/v2/execute', async (req: Request, res: Response) => {
    try {
      const toolName = String(req.body?.toolName || '').trim();
      const params = req.body?.params ?? {};

      if (!toolName) {
        return res.status(400).json({ error: 'toolName is required' });
      }

      if (toolName === 'web_search') {
        const result = await searchDriver.execute(params);
        return res.json({ success: true, result });
      }

      const result = await toolExecutor.execute({
        id: randomUUID(),
        toolName,
        arguments: params,
        missionId: req.body?.missionId,
        taskId: req.body?.taskId,
        userId: req.user!.id,
      });

      return res.status(result.status === 'success' ? 200 : 400).json({
        success: result.status === 'success',
        result: result.data ?? result.output,
        error: result.error,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/skills', async (_req: Request, res: Response) => {
    res.json({
      skills: [
        { id: 'web_search', name: 'Web Search', tools: ['web_search'] },
        { id: 'file_tools', name: 'File Tools', tools: ['read_file', 'write_file', 'create_folder', 'delete_file', 'list_files'] },
      ],
    });
  });

  app.post('/api/memory/store', async (req: Request, res: Response) => {
    try {
      const content = String(req.body?.content || '').trim();
      const metadata = typeof req.body?.metadata === 'object' && req.body.metadata ? req.body.metadata : {};

      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }

      const memory: MemoryRecord = {
        id: randomUUID(),
        userId: req.user!.id,
        content,
        metadata,
        createdAt: new Date().toISOString(),
      };

      const memories = getUserMemories(req.user!.id);
      memories.unshift(memory);
      fallbackMemories.set(req.user!.id, memories.slice(0, 500));

      await vectorStore.store(content, { userId: req.user!.id, ...metadata }).catch((err) => {
        logger.warn({ err }, '[RuntimeRoutes] Vector store degraded on memory/store');
      });

      res.status(201).json({ success: true, memory });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/memory/search', async (req: Request, res: Response) => {
    try {
      const query = String(req.body?.query || '').trim();
      const limit = Math.max(1, Math.min(Number(req.body?.limit || 5), 20));

      if (!query) {
        return res.status(400).json({ error: 'query is required' });
      }

      let results: any[] = [];

      try {
        results = await vectorStore.search(query, limit);
      } catch (err) {
        logger.warn({ err }, '[RuntimeRoutes] Falling back to naive memory search');
      }

      if (results.length === 0) {
        results = getUserMemories(req.user!.id)
          .map((memory) => ({
            id: memory.id,
            content: memory.content,
            metadata: memory.metadata,
            createdAt: memory.createdAt,
            similarity: scoreFallbackMemory(query, memory.content),
          }))
          .filter((memory) => memory.similarity > 0)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      }

      res.json({ success: true, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/memory/:id', async (req: Request, res: Response) => {
    const memories = getUserMemories(req.user!.id).filter((memory) => memory.id !== req.params.id);
    fallbackMemories.set(req.user!.id, memories);
    res.json({ success: true });
  });

  app.get('/api/channels', async (_req: Request, res: Response) => {
    await channelManager.initialize().catch(() => {});
    res.json({ channels: channelManager.getStatus() });
  });

  app.post('/api/channels', async (req: Request, res: Response) => {
    try {
      const config = req.body as ChannelConfig;
      if (!config?.id || !config?.type || !config?.name) {
        return res.status(400).json({ error: 'id, type, and name are required' });
      }

      channelManager.registerChannel(config);
      await channelManager.connectChannel(config.id).catch((err) => {
        logger.warn({ err, channelId: config.id }, '[RuntimeRoutes] Channel connection degraded');
      });

      res.status(201).json({ success: true, channel: config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

