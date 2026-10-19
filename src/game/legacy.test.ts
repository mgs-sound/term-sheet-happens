import { describe, expect, it } from 'vitest';
import { careerYears, initialCareer, legacyReached } from './career';
import { careerBeforeLegacy } from './devtools';
import { EXITS, LEGACY } from './tuning';
import type { CareerState } from './types';

const theses = [{ id: 't', sectors: ['AI', 'SaaS'] as ['AI', 'SaaS'], line: 'x' }];

function withOneMoreFund(c: CareerState): CareerState {
  const entry = c.ledger[0] ?? {
    fundIndex: 1,
    firmName: 'F',
    thesisId: 't',
    tier: 'associate' as const,
    fundSizeM: 10,
    returnedM: 5,
    dpi: 0.5,
  };
  return { ...c, ledger: [...c.ledger, entry] };
}

describe('century letter', () => {
  it('a career year count is one harvest period per fund', () => {
    expect(careerYears(initialCareer())).toBe(0);
    expect(careerYears(withOneMoreFund(initialCareer()))).toBe(EXITS.harvestYears);
  });

  it('fires exactly on the fund that reaches LEGACY.years, and only once', () => {
    const before = careerBeforeLegacy(initialCareer(), theses);
    expect(careerYears(before)).toBe(LEGACY.years - EXITS.harvestYears);
    const at = withOneMoreFund(before);
    expect(legacyReached(before, at)).toBe(true);
    expect(legacyReached(at, withOneMoreFund(at))).toBe(false);
    const earlier = { ...before, ledger: before.ledger.slice(1) };
    expect(legacyReached(earlier, before)).toBe(false);
  });
});
