import { Tool, ToolParams, ToolResult } from '../types.js';

const parseAllowedEmailDomains = () => (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

function validateEmailRecipients(to: string, cc?: string): string | null {
  const allowedDomains = parseAllowedEmailDomains();
  const recipients = [to, ...(cc ? cc.split(',') : [])].map(v => v.trim().toLowerCase()).filter(Boolean);

  for (const recipient of recipients) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return `Invalid email format: ${recipient}`;
    if (allowedDomains.length > 0) {
      const domain = recipient.split('@')[1];
      if (!allowedDomains.includes(domain)) return `Recipient domain "${domain}" is not allowed.`;
    }
  }
  return null;
}

export const emailDriver: Tool = {
  id:               'send_email',
  name:             'Send Email',
  description:      'Send an email via Gmail API or SMTP fallback',
  category:         'communication',
  riskLevel:        'high',
  requiresApproval: true,
  paramSchema: {
    to:      { type: 'string', required: true,  description: 'Recipient email' },
    subject: { type: 'string', required: true,  description: 'Subject line' },
    body:    { type: 'string', required: true,  description: 'Email body (HTML or plain text)' },
    cc:      { type: 'string', required: false, description: 'CC recipients, comma-separated' },
  },
  validate: (p) => {
    if (!p.to || typeof p.to !== 'string') return 'Missing required param: to';
    if (!p.subject) return 'Missing required param: subject';
    if (!p.body) return 'Missing required param: body';
    const recipientError = validateEmailRecipients(p.to as string, typeof p.cc === 'string' ? p.cc : undefined);
    if (recipientError) return recipientError;
    if (String(p.subject).length > 200) return 'Email subject exceeds 200 characters.';
    return null;
  },
  execute: async (params) => {
    const isSimulated = !process.env.SENDGRID_API_KEY && !process.env.SMTP_HOST;
    if (isSimulated) {
      return {
        success: true,
        data: { messageId: `sim_${Date.now()}`, to: params.to, subject: params.subject, sentAt: new Date().toISOString(), mode: 'simulated' },
        simulatedAt: Date.now(),
      };
    }
    return { success: false, error: 'Live email integration not yet configured' };
  },
};
