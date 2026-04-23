/**
 * Nexus OS — Business Agent
 *
 * Handles business owner workflows: CRM, email, calendar, invoicing, scheduling, proposals.
 * Plans are always structured DAG JSON. External actions require CEO_APPROVAL.
 */

import { logger } from '../logger.js';
import type { TaskDAG, TaskNode } from '@nexus-os/types';

export const businessAgentPrompt = `
You are the Nexus OS Business Orchestrator — a Chief of Staff AI for business owners.
You operate in outcomes, never just tasks. You always think: "What does the owner actually want to achieve?"
You have access to the owner's email, calendar, CRM, and documents.

RULES:
1. Never hallucinate data. Use tools to get real data before acting.
2. Never send external communications without CEO_APPROVAL.
3. Every response is a structured DAG plan — never prose, always JSON.
4. When you find relevant context in memory, use it (know their clients, their style, their preferences).
5. Flag risks. If an email might offend a client, say so before sending.
6. Track all actions in the mission log.

OUTPUT FORMAT:
{
  "goal": "What this achieves for the business owner",
  "risk_level": "low | medium | high",
  "requires_approval": boolean,
  "tasks": [
    { "step": 1, "tool": "tool_name", "params": {}, "description": "Human-readable description", "depends_on": [] }
  ]
}

TOOLS:
- read_crm_leads(query, limit): Get leads from HubSpot CRM
- read_crm_contact(contactId): Get detailed contact info
- draft_email(to, subject, body): Create a draft in Gmail (does NOT send)
- send_email(draftId): Send an approved draft (requires CEO_APPROVAL)
- read_invoices(startDate, endDate): Pull invoice data
- create_calendar_event(summary, start, end, attendees): Schedule a meeting
- find_free_slots(attendees, duration, range): Find mutual availability
- read_gmail_messages(query, limit): Check recent emails
- search_notion(query): Search Notion pages
- create_notion_page(title, content): Create a note/page in Notion
`;

export interface BusinessPlan {
  goal: string;
  risk_level: 'low' | 'medium' | 'high';
  requires_approval: boolean;
  tasks: Array<{
    step: number;
    tool: string;
    params: Record<string, any>;
    description: string;
    depends_on: number[];
  }>;
}

export class BusinessAgent {
  async plan(intent: string, context?: Record<string, any>): Promise<BusinessPlan> {
    logger.info({ intent }, '[BusinessAgent] Planning business mission');

    // In production: call LLM with businessAgentPrompt + intent + context
    // Returns structured DAG JSON
    // For now: return a structured plan based on intent keywords
    const lower = intent.toLowerCase();

    if (lower.includes('follow up') && lower.includes('lead')) {
      return {
        goal: 'Re-engage leads not contacted in 7+ days',
        risk_level: 'medium',
        requires_approval: true,
        tasks: [
          { step: 1, tool: 'read_crm_leads', params: { status: 'lead', not_contacted_days: 7 }, description: 'Get warm leads not contacted recently', depends_on: [] },
          { step: 2, tool: 'read_gmail_messages', params: { query: 'in:sent', limit: 10 }, description: 'Check recent sent emails for writing style', depends_on: [] },
          { step: 3, tool: 'draft_email', params: { to: '{{lead.email}}', subject: 'Quick follow-up', body: '{{generated_from_style}}' }, description: 'Draft personalized follow-up emails', depends_on: [1, 2] },
          { step: 4, tool: 'CEO_APPROVAL', params: { type: 'draft_emails', count: '{{leads.length}}' }, description: 'Show drafted emails for CEO review', depends_on: [3] },
          { step: 5, tool: 'send_email', params: { draft_ids: '{{approved_drafts}}' }, description: 'Send approved emails', depends_on: [4] },
          { step: 6, tool: 'log_crm_activity', params: { type: 'email_sent', notes: 'Follow-up sequence completed' }, description: 'Log outreach in CRM', depends_on: [5] },
        ],
      };
    }

    if (lower.includes('revenue') || lower.includes('income')) {
      return {
        goal: 'Calculate monthly revenue metrics',
        risk_level: 'low',
        requires_approval: false,
        tasks: [
          { step: 1, tool: 'read_invoices', params: { startDate: '{{month_start}}', endDate: '{{month_end}}' }, description: 'Pull invoices for current month', depends_on: [] },
          { step: 2, tool: 'calculate_metrics', params: { fields: ['total', 'paid', 'outstanding', 'vs_last_month'] }, description: 'Calculate revenue metrics', depends_on: [1] },
          { step: 3, tool: 'format_report', params: { type: 'revenue_summary' }, description: 'Format structured revenue report', depends_on: [2] },
        ],
      };
    }

    if (lower.includes('schedule') && (lower.includes('meeting') || lower.includes('call'))) {
      return {
        goal: 'Schedule a meeting with the requested person',
        risk_level: 'low',
        requires_approval: true,
        tasks: [
          { step: 1, tool: 'find_contact', params: { query: '{{person_name}}' }, description: 'Look up person in CRM/contacts', depends_on: [] },
          { step: 2, tool: 'check_calendar_availability', params: { attendees: ['{{owner_email}}', '{{contact_email}}'], duration: 60 }, description: 'Find mutual free slots', depends_on: [1] },
          { step: 3, tool: 'CEO_APPROVAL', params: { type: 'meeting_proposal', slots: '{{available_slots}}' }, description: 'Show proposed times for approval', depends_on: [2] },
          { step: 4, tool: 'create_calendar_event', params: { summary: 'Meeting with {{contact_name}}', start: '{{approved_slot.start}}', end: '{{approved_slot.end}}', attendees: ['{{contact_email}}'] }, description: 'Send calendar invite', depends_on: [3] },
        ],
      };
    }

    if (lower.includes('proposal') || lower.includes('quote')) {
      return {
        goal: 'Draft a professional proposal for the client',
        risk_level: 'high',
        requires_approval: true,
        tasks: [
          { step: 1, tool: 'read_crm_contact', params: { name: '{{client_name}}' }, description: 'Get client history and past proposals', depends_on: [] },
          { step: 2, tool: 'read_memory', params: { keys: ['proposal_templates', 'writing_style'] }, description: 'Read proposal templates and style from memory', depends_on: [] },
          { step: 3, tool: 'search_notion', params: { query: 'proposal template' }, description: 'Search for proposal templates in Notion', depends_on: [] },
          { step: 4, tool: 'draft_document', params: { type: 'proposal', client: '{{client_name}}', context: '{{contact_data}}' }, description: 'Create proposal using all context', depends_on: [1, 2, 3] },
          { step: 5, tool: 'CEO_APPROVAL', params: { type: 'document_review', document: '{{proposal_draft}}' }, description: 'CEO reviews and edits proposal', depends_on: [4] },
          { step: 6, tool: 'create_notion_page', params: { title: 'Proposal - {{client_name}}', content: '{{approved_proposal}}' }, description: 'Save final proposal to Notion', depends_on: [5] },
        ],
      };
    }

    // Default: generic business research / information gathering
    return {
      goal: 'Gather and analyze business information',
      risk_level: 'low',
      requires_approval: false,
      tasks: [
        { step: 1, tool: 'search_notion', params: { query: intent }, description: 'Search internal knowledge base', depends_on: [] },
        { step: 2, tool: 'read_crm_leads', params: { query: intent, limit: 10 }, description: 'Check CRM for related contacts', depends_on: [] },
        { step: 3, tool: 'read_gmail_messages', params: { query: intent, limit: 5 }, description: 'Check recent related emails', depends_on: [] },
        { step: 4, tool: 'format_report', params: { type: 'research_summary' }, description: 'Summarize findings', depends_on: [1, 2, 3] },
      ],
    };
  }
}

export const businessAgent = new BusinessAgent();
