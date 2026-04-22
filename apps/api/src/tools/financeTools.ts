// apps/api/src/tools/financeTools.ts

export const financeTools = {
  read_erp_purchase_order: {
    name: "read_erp_purchase_order",
    description: "Fetches the original Purchase Order (PO) from the ERP system.",
    execute: async (params: { po_number: string }) => {
      console.log(`📊 [ERP] Fetching PO: ${params.po_number}...`);
      // Mocking the ERP data for the MVP
      return { 
        po_number: params.po_number, 
        vendor: "CloudHost Inc", 
        expected_total: 4500.00, 
        agreed_discount: "10% net 30" 
      };
    }
  },
  
  scan_incoming_invoice: {
    name: "scan_incoming_invoice",
    description: "Uses OCR/Vision to extract data from a vendor invoice PDF.",
    execute: async (params: { file_path: string }) => {
      console.log(`📄 [OCR] Scanning Invoice at ${params.file_path}...`);
      // Mocking the Invoice data that has a billing error
      return {
        invoice_number: "INV-9942",
        po_reference: "PO-2026-A1",
        vendor: "CloudHost Inc",
        billed_total: 5000.00, // Error: They forgot the 10% discount!
        due_date: "Net 30"
      };
    }
  },

  draft_vendor_dispute: {
    name: "draft_vendor_dispute",
    description: "Drafts an email to the vendor disputing a billing variance.",
    execute: async (params: { vendor: string, discrepancy_amount: number, reason: string }) => {
      console.log(`✉️ [GMAIL] Drafting dispute to ${params.vendor} for $${params.discrepancy_amount}...`);
      return {
        status: "draft_ready",
        subject: `Billing Discrepancy on Invoice - ${params.vendor}`,
        body: `Hello ${params.vendor} Billing Team,\n\nWe noticed a variance of $${params.discrepancy_amount} on the latest invoice. ${params.reason}\n\nPlease issue a corrected invoice so we can process payment.\n\nBest, Nexus OS Automated AP`
      };
    }
  }
};
