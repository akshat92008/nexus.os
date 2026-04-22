// apps/api/src/tools/financeTools.ts

export interface InvoiceLineItemRecord {
  lineId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceDocument {
  invoice_number: string;
  po_reference: string;
  vendor: string;
  billed_total: number;
  currency: string;
  payment_terms: string;
  line_items: InvoiceLineItemRecord[];
}

export interface PurchaseOrderDocument {
  po_number: string;
  vendor: string;
  expected_total: number;
  currency: string;
  agreed_discount: string;
  line_items: InvoiceLineItemRecord[];
}

export interface ReversibleToolResult<T> {
  result: T;
  undo_params: Record<string, unknown>;
}

function buildMockInvoice(filePath: string): InvoiceDocument {
  const normalized = filePath.toLowerCase();
  const cleanInvoice = normalized.includes('clean');
  const freightInvoice = normalized.includes('freight');

  if (cleanInvoice) {
    return {
      invoice_number: 'INV-2026-1001',
      po_reference: 'PO-2026-A1',
      vendor: 'CloudHost Inc',
      billed_total: 4500,
      currency: 'USD',
      payment_terms: 'Net 30',
      line_items: [
        { lineId: '1', description: 'Cloud hosting annual subscription', quantity: 1, unitPrice: 4000 },
        { lineId: '2', description: 'Premium support', quantity: 1, unitPrice: 500 },
      ],
    };
  }

  if (freightInvoice) {
    return {
      invoice_number: 'INV-2026-1188',
      po_reference: 'PO-2026-B9',
      vendor: 'Acme Industrial Supply',
      billed_total: 8300,
      currency: 'USD',
      payment_terms: '2% 10 Net 45',
      line_items: [
        { lineId: '1', description: 'Hydraulic valves', quantity: 10, unitPrice: 700 },
        { lineId: '2', description: 'Freight surcharge', quantity: 1, unitPrice: 1300 },
      ],
    };
  }

  return {
    invoice_number: 'INV-9942',
    po_reference: 'PO-2026-A1',
    vendor: 'CloudHost Inc',
    billed_total: 5000,
    currency: 'USD',
    payment_terms: 'Net 30',
    line_items: [
      { lineId: '1', description: 'Cloud hosting annual subscription', quantity: 1, unitPrice: 4500 },
      { lineId: '2', description: 'Premium support', quantity: 1, unitPrice: 500 },
    ],
  };
}

function buildMockPurchaseOrder(poNumber: string): PurchaseOrderDocument {
  if (poNumber === 'PO-2026-B9') {
    return {
      po_number: poNumber,
      vendor: 'Acme Industrial Supply',
      expected_total: 7700,
      currency: 'USD',
      agreed_discount: 'Freight included in line pricing',
      line_items: [
        { lineId: '1', description: 'Hydraulic valves', quantity: 10, unitPrice: 700 },
        { lineId: '2', description: 'Freight surcharge', quantity: 1, unitPrice: 700 },
      ],
    };
  }

  return {
    po_number: poNumber,
    vendor: 'CloudHost Inc',
    expected_total: 4500,
    currency: 'USD',
    agreed_discount: '10% net 30',
    line_items: [
      { lineId: '1', description: 'Cloud hosting annual subscription', quantity: 1, unitPrice: 4000 },
      { lineId: '2', description: 'Premium support', quantity: 1, unitPrice: 500 },
    ],
  };
}

export const financeTools = {
  read_erp_purchase_order: {
    name: 'read_erp_purchase_order',
    description: 'Fetches the source Purchase Order from the ERP system.',
    execute: async (params: { po_number: string }): Promise<ReversibleToolResult<PurchaseOrderDocument>> => {
      console.log(`📊 [ERP] Fetching PO: ${params.po_number}...`);
      const result = buildMockPurchaseOrder(params.po_number);

      return {
        result,
        undo_params: {
          tool: 'read_erp_purchase_order',
          noop: true,
          po_number: params.po_number,
        },
      };
    },
  },

  scan_incoming_invoice: {
    name: 'scan_incoming_invoice',
    description: 'Extracts structured invoice data from a vendor PDF.',
    execute: async (params: { file_path: string }): Promise<ReversibleToolResult<InvoiceDocument>> => {
      console.log(`📄 [OCR] Scanning invoice at ${params.file_path}...`);
      const result = buildMockInvoice(params.file_path);

      return {
        result,
        undo_params: {
          tool: 'scan_incoming_invoice',
          noop: true,
          file_path: params.file_path,
        },
      };
    },
  },

  draft_vendor_dispute: {
    name: 'draft_vendor_dispute',
    description: 'Drafts a vendor dispute email without sending it.',
    execute: async (params: {
      vendor: string;
      invoice_number: string;
      discrepancy_amount: number;
      reason: string;
      to?: string[];
    }): Promise<ReversibleToolResult<{
      status: 'draft_ready';
      draft_id: string;
      to: string[];
      subject: string;
      body: string;
    }>> => {
      console.log(`✉️ [EMAIL] Drafting dispute to ${params.vendor} for $${params.discrepancy_amount}...`);
      const recipients = params.to?.length ? params.to : [`ap@${params.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example.com`];
      const draftId = `draft_${Math.random().toString(36).slice(2, 10)}`;
      const subject = `Billing discrepancy on invoice ${params.invoice_number}`;
      const body = [
        `Hello ${params.vendor} Billing Team,`,
        '',
        `We identified a $${params.discrepancy_amount.toFixed(2)} variance on invoice ${params.invoice_number}.`,
        params.reason,
        '',
        'Please issue a corrected invoice or confirm the billing rationale so we can proceed.',
        '',
        'Best,',
        'Nexus OS AP Automation',
      ].join('\n');

      return {
        result: {
          status: 'draft_ready',
          draft_id: draftId,
          to: recipients,
          subject,
          body,
        },
        undo_params: {
          tool: 'draft_vendor_dispute',
          draft_id: draftId,
          action: 'delete_draft',
        },
      };
    },
  },
};
