import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { careerForTier, formatSummary, simulateRun, summarizeDpis } from './sim';

const content = loadContent();

function dpisFor(tier: Parameters<typeof careerForTier>[0], runs: number): number[] {
  const dpis: number[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    dpis.push(simulateRun(careerForTier(tier), seed, content).harvest!.dpi);
  }
  return dpis;
}

describe('monte-carlo tuning harness (naive strategy)', () => {
  it('Fund I median DPI lands in the doomed-tutorial band 0.3–0.8', { timeout: 30_000 }, () => {
    const summary = summarizeDpis(dpisFor('fundI', 1000));
    console.log(formatSummary('Fund I', summary));
    expect(summary.median).toBeGreaterThanOrEqual(0.3);
    expect(summary.median).toBeLessThanOrEqual(0.8);
  });

  it('prints Fund II+ distributions for tuning (sanity bounds only)', { timeout: 60_000 }, () => {
    for (const tier of ['associate', 'partner', 'gp'] as const) {
      const summary = summarizeDpis(dpisFor(tier, 300));
      console.log(formatSummary(tier, summary));
      // Loose sanity rails, not design targets: not everyone fails, not
      // everyone is a legend.
      expect(summary.median).toBeGreaterThan(0.05);
      expect(summary.median).toBeLessThan(3);
    }
  });
});
