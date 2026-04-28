import { describe, expect, it } from 'vitest';
import { buildAPResolverAwaitingApprovalEvent, runAPResolverWorkflow } from '../workflows/apResolver.js';

describe('AP Exception Resolver', () => {
  it('returns pending approval with briefing for a mismatched invoice', async () => {
    const result = await runAPResolverWorkflow('/tmp/vendor_discount_mismatch_invoice.pdf', {
      workflowId: 'ap_test_mismatch',
    });

    expect(result.status).toBe('pending_approval');
    expect(result.requires_human).toBe(true);
    expect(result.discrepancyAmount).toBe(500);
    expect(result.workflowDag.requiresApproval).toBe(true);
    expect(result.actions).toHaveLength(3);
    expect(result.actions.every((action) => action.undo_params)).toBe(true);
    expect(result.resolutionBriefing?.recoverableAmount).toBe(500);
    expect(result.resolutionBriefing?.draftEmail.subject).toContain('INV-9942');

    const event = buildAPResolverAwaitingApprovalEvent(result);
    expect(event.type).toBe('awaiting_approval');
    expect(event.briefing?.invoiceNumber).toBe('INV-9942');
  });

  it('marks a clean invoice as completed without human review', async () => {
    const result = await runAPResolverWorkflow('/tmp/clean_invoice.pdf', {
      workflowId: 'ap_test_clean',
    });

    expect(result.status).toBe('completed');
    expect(result.requires_human).toBe(false);
    expect(result.discrepancyAmount).toBe(0);
    expect(result.resolutionBriefing).toBeUndefined();
    expect(result.actions).toHaveLength(2);
  });
});
