/**
 * Nexus OS — Structured Logger (pino)
 *
 * Single export: logger
 *
 * Usage:
 *   import { logger } from './logger.js';
 *   logger.info({ missionId, taskId, userId, duration_ms }, 'Task completed');
 *
 * All logs include timestamp automatically via pino.
 * In production, output is newline-delimited JSON.
 * In development (NODE_ENV !== 'production'), output is pretty-printed.
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino/file',
          options: { destination: 1 }, // stdout
        },
      }
    : {}),
  base: {
    service: 'nexus-api',
    env: process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export type Logger = typeof logger;
