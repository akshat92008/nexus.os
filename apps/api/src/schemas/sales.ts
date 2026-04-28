import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const CreateLeadSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
  source: z.enum(['web_form', 'email', 'linkedin', 'manual', 'api']),
  notes: z.string().max(2000).optional(),
});

export const ListLeadsQuerySchema = z.object({
  status: z.enum(['new', 'qualified', 'contacted', 'replied', 'booked', 'lost']).optional(),
  minScore: z.number().min(0).max(100).optional(),
  source: z.string().optional(),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
});

export const ScoreLeadSchema = z.object({}); // No body, just params validation potentially

export const FollowUpSchema = z.object({
  daysSinceContact: z.number().min(1).max(90).default(7),
});

export const DraftReplySchema = z.object({
  leadEmail: z.string().email(),
  leadName: z.string().optional(),
  leadCompany: z.string().optional(),
  inboundMessage: z.string().max(5000).optional(),
});

export const ApproveEmailSchema = z.object({
  action: z.enum(['approve', 'reject']),
  body: z.string().optional(),
});

export const BookMeetingSchema = z.object({
  leadId: z.string().uuid(),
  leadEmail: z.string().email(),
  leadName: z.string().max(200).optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  durationMinutes: z.number().refine((val) => [15, 30, 45, 60].includes(val)).default(30),
  meetingTitle: z.string().max(200).optional(),
});

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: result.error.flatten().fieldErrors 
      });
    }
    req.body = result.data;
    next();
  };
}
