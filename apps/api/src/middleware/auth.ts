import type { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../storage/supabaseClient.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      userId?: string;
    }
  }
}

/**
 * Validates Supabase JWT from Authorization header and attaches user info to request.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Allow health check to pass without auth
  if (req.path === '/api/health') return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const supabase = await getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email ?? '',
    };
    req.userId = user.id;

    next();
  } catch (err) {
    console.error('[AuthMiddleware] Verification failed:', err);
    return res.status(401).json({ error: 'Unauthorized: Auth check failed' });
  }
}
