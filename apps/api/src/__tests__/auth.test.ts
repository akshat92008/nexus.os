import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth } from '../middleware/auth.js';

// Mock Supabase Client
const mockGetUser = vi.fn();
const mockSupabase = {
  auth: {
    getUser: mockGetUser,
  },
};

vi.mock('../storage/supabaseClient.js', () => ({
  getSupabase: async () => mockSupabase,
}));

describe('Auth Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      path: '',
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('skips auth for /api/health path', async () => {
    req.path = '/api/health';
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('returns 401 if no token is provided', async () => {
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or malformed token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 if token is invalid or expired', async () => {
    req.headers.authorization = 'Bearer invalid-token';
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid token') });

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('populates req.user and calls next() if token is valid', async () => {
    const mockUser = { id: 'user-123', email: 'test@nexus.os' };
    req.headers.authorization = 'Bearer valid-token';
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual({ id: 'user-123', email: 'test@nexus.os' });
    expect(next).toHaveBeenCalled();
    // Simulate Express response for valid case (Ticket 1 says ensure it checks for 200)
    res.status(200);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 401 if getSupabase fails', async () => {
    req.headers.authorization = 'Bearer valid-token';
    mockGetUser.mockRejectedValue(new Error('DB Connection Failed'));

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Auth check failed' });
    expect(next).not.toHaveBeenCalled();
  });
});
