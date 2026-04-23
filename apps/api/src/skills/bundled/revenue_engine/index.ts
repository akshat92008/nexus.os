export const revenueEngineSkill = {
  name: 'revenue_engine',
  description: 'Financial modeling, unit economics, and revenue forecasting for founders',
  version: '1.0.0',
  tools: [
    {
      name: 'calculate_unit_economics',
      description: 'Calculate and benchmark CAC, LTV, payback period, and LTV:CAC ratio',
      parameters: {
        monthly_revenue: { type: 'number' },
        total_customers: { type: 'number' },
        monthly_churn_rate: { type: 'number', description: 'As decimal, e.g. 0.05 for 5%' },
        monthly_sales_marketing_spend: { type: 'number' },
        new_customers_per_month: { type: 'number' },
        gross_margin: { type: 'number', description: 'As decimal, e.g. 0.70 for 70%' }
      },
      execute: async (p: any) => {
        const arpu = p.monthly_revenue / p.total_customers;
        const ltv = (arpu * p.gross_margin) / p.monthly_churn_rate;
        const cac = p.monthly_sales_marketing_spend / p.new_customers_per_month;
        const ltvCacRatio = ltv / cac;
        const paybackMonths = cac / (arpu * p.gross_margin);
        return {
          metrics: { arpu, ltv, cac, ltvCacRatio, paybackMonths },
          benchmarks: {
            ltvCac: ltvCacRatio >= 3 ? 'HEALTHY (>3x = investor benchmark)' : ltvCacRatio >= 2 ? 'WARNING (2-3x = needs improvement)' : 'CRITICAL (<2x = unsustainable)',
            payback: paybackMonths <= 12 ? 'HEALTHY (<12mo)' : paybackMonths <= 18 ? 'WARNING (12-18mo)' : 'CRITICAL (>18mo)'
          },
          prompt: `Given these unit economics: ARPU $${arpu.toFixed(0)}/mo, LTV $${ltv.toFixed(0)}, CAC $${cac.toFixed(0)}, LTV:CAC ${ltvCacRatio.toFixed(1)}x, Payback ${paybackMonths.toFixed(1)} months.
Provide: 3 specific levers to improve LTV:CAC, the biggest risk in this model, and what benchmark investors expect at Series A for this type of business.`
        };
      }
    },
    {
      name: 'build_revenue_forecast',
      description: 'Build a 12/24/36-month revenue forecast with scenario modeling',
      parameters: {
        current_mrr: { type: 'number' },
        monthly_growth_rate: { type: 'number', description: 'As decimal' },
        churn_rate: { type: 'number' },
        arpu: { type: 'number' },
        forecast_months: { type: 'number', enum: [12, 24, 36] },
        scenarios: { type: 'array', items: { type: 'string' }, description: 'e.g. ["bear: 3%", "base: 8%", "bull: 15%"]' }
      },
      execute: async (p: any) => {
        const buildScenario = (growthRate: number) => {
          let mrr = p.current_mrr;
          const months = [];
          for (let i = 1; i <= p.forecast_months; i++) {
            mrr = mrr * (1 + growthRate - p.churn_rate);
            months.push({ month: i, mrr: Math.round(mrr), arr: Math.round(mrr * 12) });
          }
          return months;
        };
        return {
          prompt: `Build a ${p.forecast_months}-month revenue forecast starting from MRR $${p.current_mrr}.
Scenarios: ${p.scenarios.join(', ')}.
For each scenario show: MRR at month 6, 12, and end of period. ARR at end of period.
Key assumptions and sensitivity drivers. When does the company hit $1M ARR in each scenario?
What team size and infrastructure can each scenario support?`
        };
      }
    },
    {
      name: 'analyze_burn_and_runway',
      description: 'Analyze burn rate, runway, and when to raise next round',
      parameters: {
        cash_in_bank: { type: 'number' },
        monthly_burn: { type: 'number' },
        monthly_revenue: { type: 'number' },
        monthly_revenue_growth: { type: 'number' },
        target_raise_amount: { type: 'number' },
        typical_raise_duration_months: { type: 'number', description: 'How long the raise process takes' }
      },
      execute: async (p: any) => {
        const netBurn = p.monthly_burn - p.monthly_revenue;
        const runwayMonths = p.cash_in_bank / netBurn;
        const raiseStartMonth = runwayMonths - p.typical_raise_duration_months - 3; // 3mo safety buffer
        return {
          runwayMonths: Math.round(runwayMonths),
          raiseStartMonth: Math.max(1, Math.round(raiseStartMonth)),
          prompt: `Cash: $${p.cash_in_bank.toLocaleString()}, Burn: $${p.monthly_burn.toLocaleString()}/mo, Revenue: $${p.monthly_revenue.toLocaleString()}/mo.
Net burn: $${netBurn.toLocaleString()}/mo. Runway: ${Math.round(runwayMonths)} months.
Target raise: $${p.target_raise_amount.toLocaleString()}.
Advise: when to start the raise process, what milestones to hit before raising, valuation range to target, and top 3 risks to runway.`
        };
      }
    }
  ]
};
