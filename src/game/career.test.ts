import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { createRng } from './rng';
import { acceptLpOffer, closeCareerFund, initialCareer } from './career';
import { simulateRun } from './sim';
import type { GameState } from './types';
import { CAREER } from './tuning';

const content = loadContent();

/** A real harvested run, then force the harvest numbers we want to test. */
function harvestedRun(overrides: {
  dpi: number;
  fundSizeM?: number;
  reputation?: number;
}): GameState {
  const state = structuredClone(simulateRun(initialCareer(), 1234, content));
  state.fundSizeM = overrides.fundSizeM ?? state.fundSizeM;
  state.reputation = overrides.reputation ?? state.reputation;
  if (!state.harvest) throw new Error('run not harvested');
  state.harvest.dpi = overrides.dpi;
  state.harvest.returnedM = overrides.dpi * state.fundSizeM;
  return state;
}

describe('career ladder', () => {
  it('associate below 1x stays associate (new firm, resized fund)', () => {
    const next = closeCareerFund(initialCareer(), harvestedRun({ dpi: 0.6 }), createRng(1), content.theses);
    expect(next.tier).toBe('associate');
    expect(next.fundIndex).toBe(2);
    expect(next.nextFundSizeM).toBeGreaterThan(0);
    expect(next.pendingOffers).toBeNull();
  });

  it('associate at 1x+ is poached to partner', () => {
    const next = closeCareerFund(initialCareer(), harvestedRun({ dpi: 1.2 }), createRng(1), content.theses);
    expect(next.tier).toBe('partner');
  });

  it('partner at 2x+ becomes GP with three LP offers', () => {
    const partner = { ...initialCareer(), tier: 'partner' as const, fundIndex: 3 };
    const next = closeCareerFund(partner, harvestedRun({ dpi: 2.4 }), createRng(1), content.theses);
    expect(next.tier).toBe('gp');
    expect(next.pendingOffers).toHaveLength(CAREER.gpOfferCount);
    expect(next.nextFundSizeM).toBeNull();

    const chosen = acceptLpOffer(next, 1);
    expect(chosen.pendingFund?.sizeM).toBe(next.pendingOffers?.[1]?.fundSizeM);
    expect(chosen.pendingOffers).toBeNull();
  });

  it('partner below 2x stays partner', () => {
    const partner = { ...initialCareer(), tier: 'partner' as const, fundIndex: 3 };
    const next = closeCareerFund(partner, harvestedRun({ dpi: 1.5 }), createRng(1), content.theses);
    expect(next.tier).toBe('partner');
    expect(next.pendingOffers).toBeNull();
  });

  it('accumulates AUM, returned, best DPI, and DPI sizes the next fund', () => {
    const gp = { ...initialCareer(), tier: 'gp' as const, fundIndex: 4, aumM: 500 };
    const run = harvestedRun({ dpi: 2.0, fundSizeM: 200 });
    const next = closeCareerFund(gp, run, createRng(1), content.theses);
    expect(next.aumM).toBeCloseTo(700, 1);
    expect(next.totalReturnedM).toBeCloseTo(400, 1);
    expect(next.bestDpi).toBe(2.0);

    const smallRun = harvestedRun({ dpi: 0.5, fundSizeM: 200 });
    const shrunk = closeCareerFund(gp, smallRun, createRng(1), content.theses);
    expect(shrunk.nextFundSizeM!).toBeLessThan(next.nextFundSizeM!);
  });

  it('grants Enlightenment only at 3x+ on $200M+ with maxed reputation', () => {
    const gp = { ...initialCareer(), tier: 'gp' as const, fundIndex: 5 };
    const win = harvestedRun({ dpi: 3.2, fundSizeM: 300, reputation: 95 });
    const enlightened = closeCareerFund(gp, win, createRng(1), content.theses);
    expect(enlightened.enlightened).toBe(true);
    expect(enlightened.endlessUnlocked).toBe(true);

    const smallFund = harvestedRun({ dpi: 3.2, fundSizeM: 100, reputation: 95 });
    expect(closeCareerFund(gp, smallFund, createRng(1), content.theses).enlightened).toBe(false);

    const lowRep = harvestedRun({ dpi: 3.2, fundSizeM: 300, reputation: 50 });
    expect(closeCareerFund(gp, lowRep, createRng(1), content.theses).enlightened).toBe(false);
  });

  it('appends one ledger line per harvested fund', () => {
    const first = closeCareerFund(initialCareer(), harvestedRun({ dpi: 0.4 }), createRng(1), content.theses);
    expect(first.ledger).toHaveLength(1);
    expect(first.ledger[0]).toMatchObject({ fundIndex: 1, tier: 'associate', dpi: 0.4 });
    const second = closeCareerFund(first, harvestedRun({ dpi: 1.5 }), createRng(2), content.theses);
    expect(second.ledger).toHaveLength(2);
    expect(second.ledger[1]?.firmName).toBeTruthy();
  });

  it('Fund I promotion applies from fund 1 like any associate fund', () => {
    const next = closeCareerFund(initialCareer(), harvestedRun({ dpi: 1.1 }), createRng(1), content.theses);
    expect(next.tier).toBe('partner');
    expect(next.fundIndex).toBe(2);
  });
});
