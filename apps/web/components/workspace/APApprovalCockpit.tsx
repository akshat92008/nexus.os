// apps/web/components/workspace/APApprovalCockpit.tsx
'use client';

import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Mail, ShieldCheck } from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';

const fallbackBriefing = {
  vendor: 'CloudHost Inc',
  invoiceNumber: 'INV-9942',
  poNumber: 'PO-2026-A1',
  currency: 'USD',
  expectedTotal: 4500,
  billedTotal: 5000,
  discrepancyAmount: 500,
  recoverableAmount: 500,
  rootCause: 'Invoice did not apply the contracted 10% discount encoded on the purchase order.',
  recommendedAction: 'Approve dispute draft and hold payment until corrected invoice is received.',
  lineVariances: [
    {
      lineId: '1',
      description: 'Cloud hosting annual subscription',
      invoiceQuantity: 1,
      poQuantity: 1,
      invoiceUnitPrice: 4500,
      poUnitPrice: 4000,
      varianceAmount: 500,
      reason: 'Unit price mismatch: invoice $4,500.00 vs PO $4,000.00.',
    },
  ],
  draftEmail: {
    subject: 'Billing discrepancy on invoice INV-9942',
    to: ['ap@cloudhostinc.example.com'],
    body: 'Hello CloudHost Inc Billing Team,\n\nWe identified a $500.00 variance on invoice INV-9942.\nPlease issue a corrected invoice so payment can proceed.\n\nBest,\nNexus OS AP Automation',
  },
};

function money(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const APApprovalCockpit = () => {
  const pendingApproval = useNexusStore((s) => s.pendingApproval);
  const briefing = pendingApproval?.briefing ?? fallbackBriefing;
  const isLive = Boolean(pendingApproval?.briefing);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-300">
              <AlertTriangle size={22} />
              {money(briefing.recoverableAmount, briefing.currency)} recoverable capital detected
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              {pendingApproval?.reason ?? 'Nexus OS identified a supplier-side AP exception and staged the resolution package for approval.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
              {isLive ? 'Live Approval' : 'Demo Payload'}
            </div>
            <div className="mt-1 text-sm font-semibold text-white/85">
              {briefing.vendor} · {briefing.invoiceNumber}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-white/45">
            <ShieldCheck size={16} />
            Resolution Briefing
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Expected" value={money(briefing.expectedTotal, briefing.currency)} />
            <MetricCard label="Billed" value={money(briefing.billedTotal, briefing.currency)} tone="text-rose-300" />
            <MetricCard label="Variance" value={money(briefing.discrepancyAmount, briefing.currency)} tone="text-amber-300" />
          </div>

          <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-white/80">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">Root Cause</div>
            <p className="mt-2 leading-relaxed">{briefing.rootCause}</p>
          </div>

          <div className="mt-5 space-y-3">
            {briefing.lineVariances.map((line) => (
              <div key={line.lineId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-semibold text-white">{line.description}</div>
                  <div className="flex items-center gap-2 text-xs font-mono text-white/50">
                    <span>{money(line.poUnitPrice, briefing.currency)}</span>
                    <ArrowRight size={12} />
                    <span className="text-rose-300">{money(line.invoiceUnitPrice, briefing.currency)}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/65">{line.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-white/45">
              <Mail size={16} />
              Drafted Supplier Email
            </div>
            <div className="mt-4 text-sm text-white/75">
              <div className="font-semibold text-white">{briefing.draftEmail.subject}</div>
              <div className="mt-1 text-xs text-white/45">To: {briefing.draftEmail.to.join(', ')}</div>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
              {briefing.draftEmail.body}
            </pre>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-white/45">
              <FileText size={16} />
              Proposed Action
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/75">{briefing.recommendedAction}</p>

            <div className="mt-5 flex flex-col gap-3">
              <button className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white transition-all hover:bg-emerald-500">
                <CheckCircle2 size={18} />
                Approve staged resolution
              </button>
              <button className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-semibold text-white/75 transition-all hover:bg-white/10">
                Escalate to AP manager
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function MetricCard({
  label,
  value,
  tone = 'text-white',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">{label}</div>
      <div className={`mt-2 text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
