// apps/api/src/tools/businessTools.ts

import { runExternalSkill } from './skillAdapter';

export const businessTools = {
  read_crm_leads: {
    name: "read_crm_leads",
    description: "Fetches a list of leads from the CRM (e.g., HubSpot/Notion) that require follow-up.",
    execute: async (params: { days_since_contact: number }) => {
      // TODO: Connect to actual MCP/API. Mocking for demo integrity.
      console.log(`Fetching leads not contacted in ${params.days_since_contact} days...`);
      return [
        { id: "L001", name: "Acme Corp", contact: "john@acme.co", last_touch: "7 days ago", context: "Interested in Q3 rollout." },
        { id: "L002", name: "Stark Ind", contact: "tony@stark.co", last_touch: "5 days ago", context: "Waiting on pricing." }
      ];
    }
  },
  
  draft_email: {
    name: "draft_email",
    description: "Drafts a personalized email in Gmail and saves it to the drafts folder. DOES NOT SEND.",
    execute: async (params: { to: string, subject: string, body: string }) => {
      // TODO: Connect to Gmail MCP. Mocking for safety.
      console.log(`Drafting email to ${params.to}...`);
      return { 
        status: "draft_created", 
        draft_id: `draft_${Math.random().toString(36).substr(2, 9)}`,
        preview: params.body.substring(0, 50) + "..."
      };
    }
  },

  slack_notify: {
    name: "slack_notify",
    description: "Sends a summary notification to a specific Slack channel.",
    execute: async (params: { channel: string, message: string }) => {
      console.log(`[SLACK -> ${params.channel}]: ${params.message}`);
      return { status: "notified" };
    }
  },

  openclaw_calendar_sync: {
    name: "calendar_sync",
    description: "Syncs events using OpenClaw's calendar logic.",
    execute: async (params: { date_range: string }) => {
      // Wrap the copied script in our ecosystem
      const result = await runExternalSkill({
        name: "CalendarSync",
        scriptPath: "./src/external_skills/openclaw_calendar.js",
        requires_approval: false // Reading data is safe
      }, params);
      
      return result;
    }
  }
};
