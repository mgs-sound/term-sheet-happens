import { describe, expect, it } from 'vitest';
import { dilutionFactor, ownershipFromCheck, proRataCostM } from './followons';

describe('follow-on ownership math', () => {
  it('primary ownership is check over post-money', () => {
    expect(ownershipFromCheck(2, 8)).toBeCloseTo(0.2, 10);
    expect(ownershipFromCheck(1, 9)).toBeCloseTo(0.1, 10);
  });

  it('pro rata cost preserves ownership share of the new round', () => {
    expect(proRataCostM(0.15, 10)).toBeCloseTo(1.5, 10);
    expect(proRataCostM(0.2, 12.5)).toBeCloseTo(2.5, 10);
  });

  it('declining dilutes by newPre / (newPre + raise)', () => {
    expect(dilutionFactor(40, 10)).toBeCloseTo(0.8, 10);
    const ownership = 0.15;
    expect(ownership * dilutionFactor(40, 10)).toBeCloseTo(0.12, 10);
  });

  it('dilution is always in (0, 1) for positive rounds', () => {
    for (const [pre, raise] of [
      [10, 5],
      [100, 1],
      [3, 30],
    ] as const) {
      const f = dilutionFactor(pre, raise);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThan(1);
    }
  });
});
