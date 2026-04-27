import { describe, it, expect } from 'vitest';
import { revenueEngine }   from '../skills/revenueEngine.js';
import { hiringEngine }    from '../skills/hiringEngine.js';
import { pitchCoach }      from '../skills/pitchCoach.js';
import { competitorIntel } from '../skills/competitorIntel.js';
import { legalGuard }      from '../skills/legalGuard.js';
import { gtmStrategist }   from '../skills/gtmStrategist.js';

describe('Revenue Engine — unit economics math', () => {
  it('calculates ARPU, LTV, CAC correctly', () => {
    const result = revenueEngine.calculateUnitEconomics({
      monthlyRevenue: 100_000, totalCustomers: 200,
      monthlyChurnRate: 0.02, monthlySalesMarketingSpend: 30_000,
      newCustomersPerMonth: 20, grossMargin: 0.75,
    });
    expect(result.arpu).toBe(500);
    expect(result.cac).toBe(1500);
    expect(result.ltv).toBe(18_750);
    expect(result.ltvCacRatio).toBe(12.5);
    expect(result.ltvCacHealth).toBe('HEALTHY');
  });

  it('flags critical LTV:CAC', () => {
    const result = revenueEngine.calculateUnitEconomics({
      monthlyRevenue: 10_000, totalCustomers: 100,
      monthlyChurnRate: 0.15, monthlySalesMarketingSpend: 50_000,
      newCustomersPerMonth: 10, grossMargin: 0.5,
    });
    expect(result.ltvCacHealth).toBe('CRITICAL');
  });

  it('builds multi-scenario revenue projections', () => {
    const scenarios = revenueEngine.buildRevenueScenarios(50_000, 0.02, 12, [
      { name: 'bear', growthRate: 0.03 },
      { name: 'base', growthRate: 0.08 },
    ]);
    expect(scenarios).toHaveLength(2);
    expect(scenarios[1].finalArr).toBeGreaterThan(scenarios[0].finalArr);
  });

  it('calculates runway and raise timing', () => {
    const result = revenueEngine.analyzeRunway(500_000, 80_000, 20_000, 4);
    expect(result.runwayMonths).toBe(Math.round(500_000 / 60_000));
    expect(result.raiseStartMonth).toBeGreaterThan(0);
  });
});

describe('Hiring Engine — equity modeling', () => {
  it('calculates ownership percentage correctly', () => {
    const result = hiringEngine.modelEquityGrant({
      optionsGranted: 10_000, totalSharesOutstanding: 10_000_000,
      currentValuation: 10_000_000, strikePricePerShare: 1.00,
      targetExitMultiples: [5, 10], vestingSchedule: '4-year, 1-year cliff',
    });
    expect(result.ownershipPct).toBeCloseTo(0.1, 2);
    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[1].grossValue).toBeGreaterThan(result.scenarios[0].grossValue);
  });

  it('returns zero gross value when exit is below strike price', () => {
    const result = hiringEngine.modelEquityGrant({
      optionsGranted: 10_000, totalSharesOutstanding: 10_000_000,
      currentValuation: 10_000_000, strikePricePerShare: 10.00,
      targetExitMultiples: [0.5], vestingSchedule: '4-year',
    });
    expect(result.scenarios[0].grossValue).toBe(0);
  });
});

describe('Skill shape validation', () => {
  const skills = [pitchCoach, revenueEngine, competitorIntel, hiringEngine, legalGuard, gtmStrategist];

  it('every skill has a required id, name, description, category', () => {
    for (const skill of skills) {
      expect(typeof skill.id).toBe('string');
      expect(typeof skill.name).toBe('string');
      expect(typeof skill.description).toBe('string');
      expect(typeof skill.category).toBe('string');
    }
  });

  it('no two skills share the same id', () => {
    const ids = skills.map(s => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
