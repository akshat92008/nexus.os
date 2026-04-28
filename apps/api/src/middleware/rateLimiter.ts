import rateLimit from 'express-rate-limit';
import { Express } from 'express';

const logRateLimit = (type: string) => (req: any, res: any, next: any, options: any) => {
  const userId = req.user?.id || 'unauthenticated';
  console.warn(`[RateLimit] ${type} limit hit | user=${userId} ip=${req.ip} path=${req.path}`);
  res.status(429).json(options.message);
};

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests', retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
  handler: logRateLimit('General'),
});

export const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests', retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
  handler: logRateLimit('LLM-minute'),
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests', retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
  handler: logRateLimit('Auth'),
});

export const dailyLlmUserLimiter = rateLimit({

  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  message: { error: 'Daily LLM quota exceeded (100 calls/day)', retryAfter: 24 * 60 * 60 },
  standardHeaders: true,
  legacyHeaders: false,
  handler: logRateLimit('LLM-daily'),
});

export function applyRateLimits(app: Express) {
  app.use('/api/', generalLimiter);
  
  // Apply both minute IP limit and daily User limit to LLM endpoints
  const llmEndpoints = [
    '/api/sales/leads/:id/qualify',
    '/api/sales/leads/:id/followup',
    '/api/sales/leads/:id/reply',
    '/api/sales/analytics',
    '/api/sales/qualify-batch'
  ];
  
  llmEndpoints.forEach(path => {
    app.use(path, llmLimiter, dailyLlmUserLimiter);
  });
}

