import type { APLineVariance, APResolutionBriefing, ApprovalEmailDraft, AwaitingApprovalEvent, TaskDAG } from '@nexus-os/types';
import { financeTools, type InvoiceDocument, type PurchaseOrderDocument } from '../tools/financeTools.js';

export interface APResolverActionLog {
  toolName: string;
  params: Record<string, unknown>;
  undo_params: Record<string, unknown>;
}

export interface APResolverResult {
  status: 'completed' | 'pending_approval';
  summary: string;
  requires_human: boolean;
  workflowDag: TaskDAG;
  invoice: InvoiceDocument;
  purchaseOrder: PurchaseOrderDocument;
  discrepancyAmount: number;
  lineVariances: APLineVariance[];
  actions: APResolverActionLog[];
  resolutionBriefing?: APResolutionBriefing;
  data: Record<string, unknown>[];
}

export interface APResolverOptions {
  workflowId?: string;
  taskId?: string;
}

function currency(amount: number, iso: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: iso,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildWorkflowDag(workflowId: string, invoiceFilePath: string): TaskDAG {
  return {
    missionId: workflowId,
    goal: `Resolve AP exception for ${invoiceFilePath}`,
    goalType: 'analysis',
    status: 'pending',
    estimatedWaves: 4,
    successCriteria: [
      'Invoice is reconciled against the ERP purchase order.',
      'Any billing variance is quantified with line-level evidence.',
      'A reversible action package is prepared for finance review.',
      'Execution halts in a pending approval state before any external submission.',
    ],
    nodes: [
      {
        id: 'ingest_invoice',
        label: 'Read incoming invoice PDF',
        agentType: 'analyst',
        dependencies: [],
        expectedOutput: { format: 'structured_json' },
        contextFields: [],
        goalAlignment: 1,
        priority: 'critical',
        maxRetries: 1,
      },
      {
        id: 'fetch_po',
        label: 'Read ERP purchase order',
        agentType: 'analyst',
        dependencies: ['ingest_invoice'],
        expectedOutput: { format: 'structured_json' },
        contextFields: ['ingest_invoice'],
        goalAlignment: 1,
        priority: 'critical',
        maxRetries: 2,
      },
      {
        id: 'audit_variance',
        label: 'Compare invoice against PO',
        agentType: 'chief_analyst',
        dependencies: ['ingest_invoice', 'fetch_po'],
        expectedOutput: { format: 'structured_json' },
        contextFields: ['ingest_invoice', 'fetch_po'],
        goalAlignment: 1,
        priority: 'critical',
        maxRetries: 1,
      },
      {
        id: 'draft_resolution',
        label: 'Draft supplier dispute email',
        agentType: 'writer',
        dependencies: ['audit_variance'],
        expectedOutput: { format: 'structured_json' },
        contextFields: ['audit_variance'],
        goalAlignment: 0.95,
        priority: 'high',
        maxRetries: 1,
      },
      {
        id: 'halt_for_approval',
        label: 'Pause in approval cockpit',
        agentType: 'strategist',
        dependencies: ['draft_resolution'],
        expectedOutput: { format: 'structured_json' },
        contextFields: ['audit_variance', 'draft_resolution'],
        goalAlignment: 1,
        priority: 'critical',
        maxRetries: 0,
        requiresApproval: true,
      },
    ],
    requiresApproval: true,
    metadata: {
      domain: 'accounts_payable',
      executionModel: 'durable_saga',
      approvalSurface: 'director_mode',
    },
  };
}

function computeLineVariances(invoice: InvoiceDocument, po: PurchaseOrderDocument): APLineVariance[] {
  return invoice.line_items.reduce<APLineVariance[]>((acc, invoiceLine) => {
    const poLine = po.line_items.find((line) => line.lineId === invoiceLine.lineId || line.description === invoiceLine.description);
    if (!poLine) {
      acc.push({
        lineId: invoiceLine.lineId,
        description: invoiceLine.description,
        invoiceQuantity: invoiceLine.quantity,
        poQuantity: 0,
        invoiceUnitPrice: invoiceLine.unitPrice,
        poUnitPrice: 0,
        varianceAmount: invoiceLine.quantity * invoiceLine.unitPrice,
        reason: 'Line item does not exist on the purchase order.',
      });
      return acc;
    }

    const varianceAmount = (invoiceLine.quantity * invoiceLine.unitPrice) - (poLine.quantity * poLine.unitPrice);
    if (varianceAmount === 0) return acc;

    const reason =
      invoiceLine.unitPrice !== poLine.unitPrice
        ? `Unit price mismatch: invoice ${currency(invoiceLine.unitPrice, invoice.currency)} vs PO ${currency(poLine.unitPrice, po.currency)}.`
        : `Quantity mismatch: invoice ${invoiceLine.quantity} vs PO ${poLine.quantity}.`;

    acc.push({
      lineId: invoiceLine.lineId,
      description: invoiceLine.description,
      invoiceQuantity: invoiceLine.quantity,
      poQuantity: poLine.quantity,
      invoiceUnitPrice: invoiceLine.unitPrice,
      poUnitPrice: poLine.unitPrice,
      varianceAmount,
      reason,
    });
    return acc;
  }, []);
}

function determineRootCause(po: PurchaseOrderDocument, lineVariances: APLineVariance[]): string {
  if (lineVariances.some((line) => line.description.toLowerCase().includes('freight'))) {
    return `Supplier billed freight outside agreed commercial terms. ERP PO indicates "${po.agreed_discount}".`;
  }

  return `Invoice does not reflect agreed commercial terms on the PO (${po.agreed_discount}).`;
}

function buildBriefing(params: {
  workflowId: string;
  invoice: InvoiceDocument;
  po: PurchaseOrderDocument;
  discrepancyAmount: number;
  lineVariances: APLineVariance[];
  draftEmail: ApprovalEmailDraft;
}): APResolutionBriefing {
  const rootCause = determineRootCause(params.po, params.lineVariances);

  return {
    workflowId: params.workflowId,
    invoiceNumber: params.invoice.invoice_number,
    poNumber: params.po.po_number,
    vendor: params.invoice.vendor,
    currency: params.invoice.currency,
    expectedTotal: params.po.expected_total,
    billedTotal: params.invoice.billed_total,
    discrepancyAmount: params.discrepancyAmount,
    recoverableAmount: Math.max(params.discrepancyAmount, 0),
    discrepancyKind: params.discrepancyAmount >= 0 ? 'overcharge' : 'undercharge',
    rootCause,
    recommendedAction: 'Approve draft dispute email and stage ERP note for AP analyst review.',
    confidence: 'high',
    lineVariances: params.lineVariances,
    draftEmail: params.draftEmail,
    proposedErpUpdate: `Add AP exception note to ${params.po.po_number} referencing invoice ${params.invoice.invoice_number} and hold payment until corrected.`,
  };
}

export function buildAPResolverAwaitingApprovalEvent(
  result: APResolverResult,
  taskId = 'ap_exception_resolver'
): AwaitingApprovalEvent {
  return {
    type: 'awaiting_approval',
    taskId,
    taskLabel: 'Autonomous AP Exception Resolver',
    reason: result.summary,
    briefing: result.resolutionBriefing,
  };
}

export async function runAPResolverWorkflow(
  invoiceFilePath: string,
  options: APResolverOptions = {}
): Promise<APResolverResult> {
  const workflowId = options.workflowId ?? `ap_${Date.now()}`;
  const workflowDag = buildWorkflowDag(workflowId, invoiceFilePath);
  const actions: APResolverActionLog[] = [];

  console.log('🚀 STARTING DAG: Autonomous AP Exception Resolver');
  console.log('-> [Node 1] Ingesting vendor invoice...');
  const invoiceRead = await financeTools.scan_incoming_invoice.execute({ file_path: invoiceFilePath });
  actions.push({
    toolName: financeTools.scan_incoming_invoice.name,
    params: { file_path: invoiceFilePath },
    undo_params: invoiceRead.undo_params,
  });
  const invoice = invoiceRead.result;

  console.log(`-> [Node 2] Querying ERP for PO ${invoice.po_reference}...`);
  const poRead = await financeTools.read_erp_purchase_order.execute({ po_number: invoice.po_reference });
  actions.push({
    toolName: financeTools.read_erp_purchase_order.name,
    params: { po_number: invoice.po_reference },
    undo_params: poRead.undo_params,
  });
  const purchaseOrder = poRead.result;

  console.log('-> [Node 3] Auditing line-level discrepancies...');
  const lineVariances = computeLineVariances(invoice, purchaseOrder);
  const discrepancyAmount = Number((invoice.billed_total - purchaseOrder.expected_total).toFixed(2));

  if (discrepancyAmount <= 0) {
    return {
      status: 'completed',
      summary: `Invoice ${invoice.invoice_number} reconciled cleanly against ${purchaseOrder.po_number}.`,
      requires_human: false,
      workflowDag,
      invoice,
      purchaseOrder,
      discrepancyAmount,
      lineVariances,
      actions,
      data: [],
    };
  }

  const rootCause = determineRootCause(purchaseOrder, lineVariances);

  console.log('-> [Node 4] Drafting supplier resolution...');
  const draftResponse = await financeTools.draft_vendor_dispute.execute({
    vendor: invoice.vendor,
    invoice_number: invoice.invoice_number,
    discrepancy_amount: discrepancyAmount,
    reason: rootCause,
  });
  actions.push({
    toolName: financeTools.draft_vendor_dispute.name,
    params: {
      vendor: invoice.vendor,
      invoice_number: invoice.invoice_number,
      discrepancy_amount: discrepancyAmount,
    },
    undo_params: draftResponse.undo_params,
  });

  const draftEmail: ApprovalEmailDraft = {
    draftId: draftResponse.result.draft_id,
    to: draftResponse.result.to,
    subject: draftResponse.result.subject,
    body: draftResponse.result.body,
  };
  const resolutionBriefing = buildBriefing({
    workflowId,
    invoice,
    po: purchaseOrder,
    discrepancyAmount,
    lineVariances,
    draftEmail,
  });

  console.log('🛑 HALT: Workflow paused at Approval Cockpit.');
  return {
    status: 'pending_approval',
    summary: `Recovered ${currency(discrepancyAmount, invoice.currency)} from ${invoice.vendor}. Draft staged for approval.`,
    requires_human: true,
    workflowDag,
    invoice,
    purchaseOrder,
    discrepancyAmount,
    lineVariances,
    actions,
    resolutionBriefing,
    data: [
      {
        draftEmail,
        resolutionBriefing,
      },
    ],
  };
}
