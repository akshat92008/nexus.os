import { Express, Request, Response } from 'express';
import { getSupabase } from '../storage/supabaseClient.js';
import crypto from 'crypto';
import { leadCapture } from '../sales/leadCapture.js';
import { leadScorer } from '../sales/leadScorer.js';
import { salesAgent } from '../sales/salesAgent.js';
import { bookingEngine } from '../sales/bookingEngine.js';
import { analyticsEngine } from '../sales/analyticsEngine.js';
import { approvalService } from '../sales/approvalService.js';
import { emailSender } from '../sales/emailSender.js';
import { 
  validate, 
  CreateLeadSchema, 
  FollowUpSchema, 
  DraftReplySchema, 
  ApproveEmailSchema, 
  BookMeetingSchema 
} from '../schemas/sales.js';

export function registerSalesRoutes(app: Express): void {

  // ── Lead CRUD ──────────────────────────────────────────────────────────

  app.post('/api/sales/leads', validate(CreateLeadSchema), async (req: Request, res: Response) => {
    try {
      const lead = await leadCapture.capture(req.user!.id, req.body);
      res.status(201).json(lead);
    } catch (err: any) {
      const status = err.message.includes('email') ? 400 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  app.post('/api/sales/leads/import', async (req: Request, res: Response) => {
    try {
      const { csv } = req.body;
      if (!csv) return res.status(400).json({ error: 'csv field is required' });
      const result = await leadCapture.importCSV(req.user!.id, csv);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });


  app.get('/api/sales/leads', async (req: Request, res: Response) => {
    try {
      const filters = {
        status: req.query.status as string,
        minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
        source: req.query.source as string,
        limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 200) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };
      const result = await leadCapture.getLeads(req.user!.id, filters);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sales/leads/:id', async (req: Request, res: Response) => {
    try {
      const lead = await leadCapture.getLead(req.user!.id, req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json(lead);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Lead Scoring ───────────────────────────────────────────────────────

  app.post('/api/sales/leads/:id/qualify', async (req: Request, res: Response) => {
    try {
      const result = await leadScorer.scoreLead(req.params.id, req.user!.id);
      res.json(result);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  app.post('/api/sales/qualify-batch', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.body?.limit || '20'), 50);
      const result = await leadScorer.scoreBatch(req.user!.id, limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Follow-up & Reply Drafting ─────────────────────────────────────────

  app.post('/api/sales/leads/:id/followup', validate(FollowUpSchema), async (req: Request, res: Response) => {
    try {
      const lead = await leadCapture.getLead(req.user!.id, req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      const result = await salesAgent.draftFollowUp(req.params.id, req.user!.id, req.body.daysSinceContact);
      res.json(result);
    } catch (err: any) {
      const status = err.message.includes('not eligible') || err.message.includes('Max') ? 400 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  app.post('/api/sales/leads/:id/reply', validate(DraftReplySchema), async (req: Request, res: Response) => {
    try {
      const result = await salesAgent.draftReply(req.params.id, req.user!.id, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Approval Queue ─────────────────────────────────────────────────────

  app.get('/api/sales/approvals', async (req: Request, res: Response) => {
    try {
      const approvals = await approvalService.listPending(req.user!.id);
      res.json({ approvals, count: approvals.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sales/history', async (req: Request, res: Response) => {
    try {
      const history = await approvalService.listSent(req.user!.id);
      res.json({ history, count: history.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sales/approve/:approvalId', validate(ApproveEmailSchema), async (req: Request, res: Response) => {
    try {
      if (req.body.action === 'approve') {
        const result = await emailSender.approveAndSend(req.params.approvalId, req.user!.id, req.body.body);
        res.json(result);
      } else {
        await emailSender.reject(req.params.approvalId, req.user!.id);
        res.json({ rejected: true });
      }
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  app.post('/api/sales/approve-batch', async (req: Request, res: Response) => {
    try {
      const { approvalIds } = req.body;
      if (!Array.isArray(approvalIds)) {
        return res.status(400).json({ error: 'approvalIds must be an array' });
      }

      const results = [];
      for (const id of approvalIds) {
        try {
          const result = await emailSender.approveAndSend(id, req.user!.id);
          results.push({ id, status: 'success', result });
        } catch (e: any) {
           results.push({ id, status: 'error', error: e.message });
        }
      }
      res.json({ processed: approvalIds.length, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Scheduled Follow-ups ───────────────────────────────────────────────

  app.post('/api/sales/followups/run', async (req: Request, res: Response) => {
    try {
      const result = await salesAgent.runScheduledFollowUps(req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Meeting Booking ────────────────────────────────────────────────────

  app.post('/api/sales/book', validate(BookMeetingSchema), async (req: Request, res: Response) => {
    try {
      const result = await bookingEngine.bookMeeting({
        leadId: req.body.leadId,
        userId: req.user!.id,
        leadEmail: req.body.leadEmail,
        leadName: req.body.leadName,
        preferredDate: req.body.preferredDate,
        durationMinutes: req.body.durationMinutes,
        meetingTitle: req.body.meetingTitle
      });
      res.json(result);
    } catch (err: any) {
      const status = err.message.includes('No available') ? 409 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  // GET /api/sales/slots
  app.get('/api/sales/slots', async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      const duration = parseInt(req.query.duration as string || '30');
      const slots = await bookingEngine.findAvailableSlots(req.user!.id, date, duration);
      res.json({ date, duration, slots });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sales/analytics/funnel
  app.get('/api/sales/analytics/funnel', async (req: Request, res: Response) => {
    try {
      const days = parseInt((req.query.days as string) || '30');
      const metrics = await analyticsEngine.getFunnelMetrics(req.user!.id, days);
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sales/analytics
  app.get('/api/sales/analytics', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string || '30');
      const result = await analyticsEngine.getInsights(req.user!.id, days);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sales/subscribe — DISABLED until real payment integration is built
  // DO NOT re-enable without: Razorpay/Stripe webhook signature verification
  app.post('/api/sales/subscribe', (_req: Request, res: Response) => {
    return res.status(503).json({
      error: 'Billing is being configured. Please contact support@yourdomain.com to upgrade your plan.',
      code: 'BILLING_NOT_READY',
    });
  });

  // GET /api/unsubscribe — Public unsubscribe link (no auth required, but HMAC-verified)
  app.get('/api/unsubscribe', async (req: Request, res: Response) => {
    try {
      const { token, lead } = req.query as { token: string; lead: string };
      if (!token || !lead) {
        return res.status(400).send('Invalid unsubscribe link.');
      }

      // Verify HMAC token to prevent unauthorized unsubscribes
      const secret = process.env.SUPABASE_SERVICE_KEY?.slice(0, 32) || 'nexus-unsub-secret';
      // We need the userId to verify — fetch the lead first
      const supabase = await getSupabase();
      const { data: leadRow, error: fetchErr } = await supabase
        .from('leads')
        .select('id, user_id')
        .eq('id', lead)
        .single();

      if (fetchErr || !leadRow) {
        return res.status(400).send('Invalid unsubscribe link.');
      }

      const expectedToken = crypto.createHmac('sha256', secret).update(`${lead}:${leadRow.user_id}`).digest('hex').slice(0, 32);
      if (token !== expectedToken) {
        return res.status(403).send('Invalid or expired unsubscribe link.');
      }

      // Mark lead as unsubscribed in DB
      const { error } = await supabase
        .from('leads')
        .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
        .eq('id', lead);

      if (error) {
        return res.status(500).send('Failed to process unsubscribe. Please contact support.');
      }

      // Return a clean HTML confirmation page
      return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Unsubscribed</title><meta charset="utf-8"></head>
        <body style="font-family:sans-serif;max-width:400px;margin:80px auto;text-align:center;color:#333">
          <h2>You've been unsubscribed</h2>
          <p>You won't receive any more emails from us. This takes effect immediately.</p>
        </body>
      </html>
    `);
    } catch (err: any) {
      return res.status(500).send('Something went wrong.');
    }
  });

}
