import { describe, expect, it } from 'vitest';
import {
  PLAYER_NAME_MAX,
  careerYears,
  heirCareer,
  heirName,
  initialCareer,
  legacyReached,
} from './career';
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

describe('heir', () => {
  it('names the dynasty: Jr., then III, IV…', () => {
    expect(heirName('John Doe')).toBe('John Doe Jr.');
    expect(heirName('John Doe Jr.')).toBe('John Doe III');
    expect(heirName('John Doe III')).toBe('John Doe IV');
    expect(heirName('x'.repeat(40))).toHaveLength(PLAYER_NAME_MAX);
  });

  it('starts a fresh career that remembers the grandparent', () => {
    const grandpa = { ...careerBeforeLegacy(initialCareer(), theses), playerName: 'Ana Ruiz' };
    const heir = heirCareer(grandpa, 'John Doe');
    expect(heir.playerName).toBe('Ana Ruiz Jr.');
    expect(heir.ledger).toHaveLength(0);
    expect(heir.tier).toBe('associate');
    expect(heir.heirOf).toEqual({
      name: 'Ana Ruiz',
      funds: grandpa.ledger.length,
      years: careerYears(grandpa),
      returnedM: grandpa.totalReturnedM,
    });
    expect(heirCareer(initialCareer(), 'John Doe').playerName).toBe('John Doe Jr.');
  });
});

describe('succession letter', () => {
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
