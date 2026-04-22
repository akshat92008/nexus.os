// apps/api/src/workflows/apResolver.ts

import { financeTools } from '../tools/financeTools';

export async function runAPResolverWorkflow(invoiceFilePath: string) {
  console.log("🚀 STARTING DAG: Autonomous AP Exception Resolver");

  // NODE 1: Read the new invoice
  console.log("-> [Node 1] Ingesting Vendor Invoice...");
  const invoice = await financeTools.scan_incoming_invoice.execute({ file_path: invoiceFilePath });

  // NODE 2: Read the internal ERP PO
  console.log(`-> [Node 2] Cross-referencing internal ERP for PO: ${invoice.po_reference}...`);
  const po = await financeTools.read_erp_purchase_order.execute({ po_number: invoice.po_reference });

  // NODE 3: Reasoning & Math (The "Intelligence" Node)
  console.log("-> [Node 3] Auditing line items and discounts...");
  let discrepancy = invoice.billed_total - po.expected_total;
  
  if (discrepancy > 0) {
    console.log(`⚠️ DISCREPANCY DETECTED: Vendor overcharged by $${discrepancy}. Reason: Missing agreed 10% discount.`);
    
    // NODE 4: Action (Drafting the fix)
    console.log("-> [Node 4] Drafting vendor dispute email...");
    const draft = await financeTools.draft_vendor_dispute.execute({
      vendor: invoice.vendor,
      discrepancy_amount: discrepancy,
      reason: "The invoice does not reflect our agreed '10% net 30' discount specified in the PO."
    });

    // NODE 5: The Approval Gate
    console.log("🛑 HALT: Workflow paused at CEO Approval Cockpit.");
    return {
        status: "pending_approval",
        summary: `🚨 Found $${discrepancy} billing error from ${invoice.vendor}. Drafted dispute email to recover funds.`,
        requires_human: true,
        data: [draft]
    };
  } else {
    console.log("✅ Invoice matches PO. Marking as 'Approved for Payment'.");
    return { status: "completed", summary: "Invoice clean. Sent to payments.", data: [] };
  }
}
