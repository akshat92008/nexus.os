import type { Request, Response, NextFunction } from 'express';

let privacyEnabled = process.env.NEXUS_PRIVACY_MODE === 'true';

export function setPrivacyMode(enabled: boolean) { privacyEnabled = enabled; }
export function isPrivacyMode() { return privacyEnabled; }

export function privacyMiddleware(req: Request, _res: Response, next: NextFunction) {
  (req as any).privacyMode = privacyEnabled;
  if (privacyEnabled) {
    // Strip PII from request body/logging
    const body = JSON.parse(JSON.stringify(req.body || {}));
    const piiKeys = ['email', 'phone', 'ssn', 'password', 'token', 'credit_card'];
    for (const key of piiKeys) { if (body[key]) body[key] = '[REDACTED]'; }
    (req as any).sanitizedBody = body;
  }
  next();
}
