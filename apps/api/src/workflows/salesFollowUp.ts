// apps/api/src/workflows/salesFollowUp.ts

import { businessTools } from '../tools/businessTools.js';

export async function runSalesFollowUpWorkflow() {
  console.log("🚀 STARTING DAG: Sales Follow-Up Automation");

  // NODE 1: Fetch Data
  console.log("-> [Node 1] Reading CRM...");
  const leads = await businessTools.read_crm_leads.execute({ days_since_contact: 5 });
  
  const draftResults = [];

  // NODE 2: Parallel Execution (Drafting Emails)
  console.log(`-> [Node 2] Drafting ${leads.length} emails in parallel...`);
  await Promise.all(leads.map(async (lead) => {
    const draft = await businessTools.draft_email.execute({
      to: lead.contact,
      subject: `Following up regarding ${lead.name}`,
      body: `Hi, just following up on our previous conversation regarding: ${lead.context}. Are you still interested?`
    });
    draftResults.push(draft);
  }));

  // NODE 3: Notification
  console.log("-> [Node 3] Notifying CEO via Slack...");
  await businessTools.slack_notify.execute({
    channel: "#sales-automation",
    message: `Drafted ${draftResults.length} follow-up emails. Awaiting CEO Approval in Nexus OS Dashboard.`
  });

  // NODE 4: The CEO Approval Gate
  console.log("🛑 HALT: Workflow paused at CEO Approval Gate.");
  return {
    status: "pending_approval",
    summary: `Ready to send ${draftResults.length} emails.`,
    requires_human: true,
    data: draftResults
  };
}
