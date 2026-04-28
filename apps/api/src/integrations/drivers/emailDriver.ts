import { Tool } from '../types.js';
import { env } from '../../config/env.js';
import { z } from 'zod';

export const emailDriver: Tool = {
  id:               'send_email',
  name:             'Send Email',
  description:      'Send an email using SendGrid or Resend API',
  category:         'communication',
  riskLevel:        'high',
  requiresApproval: true,
  schema: z.object({ 
    to: z.string().email(), 
    subject: z.string().max(200), 
    body: z.string().max(50_000), 
  }),
  paramSchema: {
    to:      { type: 'string', required: true,  description: 'Recipient email' },
    subject: { type: 'string', required: true,  description: 'Subject line' },
    body:    { type: 'string', required: true,  description: 'Email body (HTML)' },
    from:    { type: 'string', required: false, description: 'Sender name or email (optional)' },
  },
  validate: (p) => {
    if (!p.to || typeof p.to !== 'string') return 'Missing required param: to';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.to)) return `Invalid email format: ${p.to}`;
    if (!p.subject) return 'Missing required param: subject';
    if (!p.body) return 'Missing required param: body';
    return null;
  },
  execute: async (params) => {
    if (!process.env.SENDGRID_API_KEY && !process.env.RESEND_API_KEY) {
      throw new Error('No email provider configured. Set SENDGRID_API_KEY or RESEND_API_KEY in your environment.');
    }

    // Startup guard: prevent sending from unverified dev addresses in production
    if (env.NODE_ENV === 'production' && env.EMAIL_FROM_ADDRESS.includes('localhost')) {
      throw new Error('EMAIL_FROM_ADDRESS is set to a localhost address in production. Emails will be rejected. Set a real verified sender address.');
    }

    const sendgridKey = process.env.SENDGRID_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    try {
      // Prefer SendGrid if available
      if (sendgridKey) {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: params.to }] }],
            from: { 
              email: params.from || env.EMAIL_FROM_ADDRESS, 
              name: env.EMAIL_FROM_NAME 
            },
            subject: params.subject,
            content: [{ type: 'text/html', value: params.body }],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as any;
          const errorMsg = errorData.errors?.[0]?.message || response.statusText;
          console.error('[EmailDriver] SendGrid failed:', errorMsg);
          
          // If SendGrid fails and Resend is available, fallback to Resend
          if (!resendKey) {
            throw new Error(`SendGrid API error (${response.status}): ${errorMsg}`);
          }
          console.warn('[EmailDriver] SendGrid failed, attempting fallback to Resend');
        } else {
          return {
            success: true,
            data: {
              provider: 'SendGrid',
              to: params.to,
              subject: params.subject,
              sentAt: new Date().toISOString(),
            },
          };
        }
      }

      // Fallback to Resend
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: params.from || `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
          to: params.to,
          subject: params.subject,
          html: params.body,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(`Resend API error (${response.status}): ${errorData.message || response.statusText}`);
      }

      const data = await response.json() as any;
      
      return {
        success: true,
        data: {
          provider: 'Resend',
          messageId: data.id,
          to: params.to,
          subject: params.subject,
          sentAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      console.error('[EmailDriver] Email execution failed:', err);
      return {
        success: false,
        error: err.message || 'Failed to send email',
      };
    }
  },
};
