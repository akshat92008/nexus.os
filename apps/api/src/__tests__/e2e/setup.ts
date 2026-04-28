import { beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { missionRecorder, missionReplayer } from '../missionReplay.js';

// Global test server for e2e tests
let testServer: any;
let testPort: number;

beforeAll(async () => {
  // Set up test environment
  process.env.NODE_ENV = 'test';
  process.env.MISSION_REPLAY_MODE = process.env.MISSION_REPLAY_MODE || 'record';

  // Initialize mission replay system
  if (process.env.MISSION_REPLAY_MODE === 'replay') {
    missionReplayer.enableReplayMode();
    await missionReplayer.loadRecordings();
  }

  // Create test server
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Mock API routes for testing
  app.post('/api/missions', async (req, res) => {
    const { goal, goalType, userId = 'test-user' } = req.body;

    try {
      const missionId = `test-mission-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const sessionId = `test-session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Start recording if in record mode
      if (process.env.MISSION_REPLAY_MODE === 'record') {
        missionRecorder.startRecording();
      }

      res.json({
        success: true,
        missionId,
        sessionId,
        status: 'created',
        userId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/missions/:missionId/status', (req, res) => {
    const { missionId } = req.params;

    res.json({
      missionId,
      status: 'completed',
      progress: 100,
      result: {
        success: true,
        artifacts: []
      }
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Start server on random port
  testServer = createServer(app);
  await new Promise<void>((resolve) => {
    testServer.listen(0, () => {
      testPort = (testServer.address() as any).port;
      // Set global variable for tests to use
      (global as any).TEST_BASE_URL = `http://localhost:${testPort}`;
      resolve();
    });
  });
});

afterAll(async () => {
  // Clean up test server
  if (testServer) {
    await new Promise<void>((resolve) => {
      testServer.close(() => resolve());
    });
  }

  // Save recordings if in record mode
  if (process.env.MISSION_REPLAY_MODE === 'record') {
    try {
      await missionRecorder.saveRecording();
    } catch (error) {
      console.warn('Failed to save mission recording:', error);
    }
  }

  // Reset environment
  delete process.env.MISSION_REPLAY_MODE;
});