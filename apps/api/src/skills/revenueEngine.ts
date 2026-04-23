/**
 * Nexus OS — Revenue Engine Skill
 * Unit economics, forecasting, burn rate, and fundraising timing.
 */
import { llmRouter } from '../llm/LLMRouter.js';
import { MODEL_POWER } from '../agents/agentConfig.js';

type UnitEconomicsResult = {
  arpu: number;
  ltv: number;
  cac: number;
  ltvCacRatio: number;
  paybackMonths: number;
  ltvCacHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  paybackHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  summary: string;
};

export const revenueEngine = {
  id: 'revenue_engine',
  name: 'Revenue Engine',
  description: 'Unit economics, revenue forecasting, burn analysis, and fundraising timing',
  category: 'business',

  calculateUnitEconomics(params: {
    monthlyRevenue: number; totalCustomers: number; monthlyChurnRate: number;
    monthlySalesMarketingSpend: number; newCustomersPerMonth: number; grossMargin: number;
  }): UnitEconomicsResult {
    const arpu = params.monthlyRevenue / params.totalCustomers;
    const ltv  = (arpu * params.grossMargin) / params.monthlyChurnRate;
    const cac  = params.monthlySalesMarketingSpend / params.newCustomersPerMonth;
    const ltvCacRatio   = ltv / cac;
    const paybackMonths = cac / (arpu * params.grossMargin);

    const ltvCacHealth  = ltvCacRatio >= 3 ? 'HEALTHY' : ltvCacRatio >= 2 ? 'WARNING' : 'CRITICAL';
    const paybackHealth = paybackMonths <= 12 ? 'HEALTHY' : paybackMonths <= 18 ? 'WARNING' : 'CRITICAL';

    return {
      arpu:           Math.round(arpu),
      ltv:            Math.round(ltv),
      cac:            Math.round(cac),
      ltvCacRatio:    Math.round(ltvCacRatio * 10) / 10,
      paybackMonths:  Math.round(paybackMonths * 10) / 10,
      ltvCacHealth,
      paybackHealth,
      summary: `ARPU $${Math.round(arpu)}/mo | LTV $${Math.round(ltv)} | CAC $${Math.round(cac)} | LTV:CAC ${(ltvCacRatio).toFixed(1)}x [${ltvCacHealth}] | Payback ${paybackMonths.toFixed(1)}mo [${paybackHealth}]`,
    };
  },

  async analyzeAndAdvise(metrics: UnitEconomicsResult): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER,
      temperature: 0.3,
      maxTokens: 600,
      system: 'You are a CFO and revenue operator. Be specific, not generic.',
      user: `Unit economics: ${metrics.summary}

Provide:
1. The three highest-leverage levers to improve LTV:CAC (specific, not obvious)
2. What Series A investors will say about these numbers and what milestone you need to reach before raising
3. The single biggest structural risk in this model
4. One non-obvious benchmark comparison from a comparable company at this stage`,
    });
    return content;
  },

  buildRevenueScenarios(currentMrr: number, churnRate: number, months: number, scenarios: { name: string; growthRate: number }[]) {
    return scenarios.map(s => {
      let mrr = currentMrr;
      const projection = [];
      for (let i = 1; i <= months; i++) {
        mrr = mrr * (1 + s.growthRate - churnRate);
        projection.push({ month: i, mrr: Math.round(mrr), arr: Math.round(mrr * 12) });
      }
      const final = projection[projection.length - 1];
      const m6    = projection[5];
      const m12   = projection[11] ?? final;
      return { scenario: s.name, growthRate: `${(s.growthRate * 100).toFixed(1)}%`, m6Mrr: m6?.mrr, m12Mrr: m12?.mrr, finalMrr: final.mrr, finalArr: final.arr };
    });
  },

  analyzeRunway(cashInBank: number, monthlyBurn: number, monthlyRevenue: number, raiseDurationMonths: number) {
    const netBurn        = Math.max(monthlyBurn - monthlyRevenue, 1);
    const runwayMonths   = Math.round(cashInBank / netBurn);
    const raiseStartMonth = Math.max(1, runwayMonths - raiseDurationMonths - 3);
    return {
      netBurnPerMonth: Math.round(netBurn),
      runwayMonths,
      raiseStartMonth,
      raiseDeadline: `Start raise in month ${raiseStartMonth} to close before cash-out with 3-month safety buffer`,
    };
  },
};
