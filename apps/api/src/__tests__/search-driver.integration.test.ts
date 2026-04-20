import { describe, it, expect } from 'vitest';
import { searchDriver } from '../integrations/drivers/searchDriver.js';

/**
 * Integration test for Search Driver
 * 
 * This test requires TAVILY_API_KEY to be set in the .env file.
 * Remove the .skip to run integration tests against the live Tavily API.
 * 
 * Usage: TAVILY_API_KEY=tvly-xxx pnpm test -- --run search-driver.integration
 */
describe.skip('Search Driver — Integration (Live Tavily API)', () => {
  it('should search and return real results from Tavily', async () => {
    const result = await searchDriver.execute({ query: 'Nexus AI Operating System', limit: 3 });

    expect(result.success).toBe(true);
    expect(result.data.results).toBeDefined();
    expect(result.data.results.length).toBeGreaterThan(0);
    expect(result.data.results.length).toBeLessThanOrEqual(3);
    
    // Validate structure of results
    result.data.results.forEach(r => {
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('url');
      expect(r).toHaveProperty('snippet');
      expect(r).toHaveProperty('score');
      expect(typeof r.score).toBe('number');
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    });
  });

  it('should handle complex search queries', async () => {
    const complexQuery = 'Python async/await best practices 2024';
    const result = await searchDriver.execute({ query: complexQuery, limit: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('results');
    expect(result.data).toHaveProperty('query', complexQuery);
  });

  it('should respect the limit parameter', async () => {
    const result = await searchDriver.execute({ query: 'news', limit: 1 });
    
    expect(result.success).toBe(true);
    expect(result.data.results.length).toBeLessThanOrEqual(1);
  });
});
