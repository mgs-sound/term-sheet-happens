import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { acceptStay, closeCareerFund, stayOption } from './career';
import { createRun } from './engine';
import { eligibleOfferProfiles, offerProfileFor } from './fundTerms';
import { createRng } from './rng';
import { careerForTier, simulateRun } from './sim';
import { OFFER_PROFILES, STAY } from './tuning';
import type { GameState } from './types';

const content = loadContent();
const ec = { pitches: content.pitches, theses: content.theses, firmNames: content.firmNames };

function harvested(dpi: number, met: boolean): { run: GameState; career: ReturnType<typeof careerForTier> } {
  const career = careerForTier('associate');
  const run = simulateRun(career, 11, ec);
  run.harvest = { ...run.harvest!, dpi, returnedM: dpi * run.fundSizeM };
  run.lpRequests = [{ kind: 'onThesis', status: met ? 'met' : 'broken', lineIndex: 0 }];
  return { run, career };
}

describe('staying at your firm', () => {
  it('is only allowed when every LP request was met', () => {
    const { run, career } = harvested(0.8, false);
    const next = closeCareerFund(career, run, createRng(1), content.theses);
    expect(stayOption(next, run).allowed).toBe(false);
    expect(() => acceptStay(next, stayOption(next, run))).toThrow();
  });

  it('below 1x: same rung, fund not shrunk for the DPI', () => {
    const { run, career } = harvested(0.6, true);
    const next = closeCareerFund(career, run, createRng(1), content.theses);
    const stay = stayOption(next, run);
    expect(stay.allowed).toBe(true);
    expect(stay.tier).toBe('associate');
    expect(stay.fundSizeM).toBeCloseTo(run.fundSizeM, 1);
    expect(stay.fundSizeM).toBeGreaterThan(next.nextFundSizeM!); // outside shrank
  });

  it('1x+: in-house promotion, a fund over the outside base, same firm + thesis', () => {
    const { run, career } = harvested(1.4, true);
    const next = closeCareerFund(career, run, createRng(1), content.theses);
    const stay = stayOption(next, run);
    expect(stay.tier).toBe('partner');
    expect(stay.fundSizeM).toBeCloseTo(next.nextFundSizeM! * STAY.winSizeMult, 0);
    const fund = createRun(acceptStay(next, stay), 99, ec);
    expect(fund.firmName).toBe(run.firmName);
    expect(fund.thesis.id).toBe(run.thesis.id);
    expect(fund.fundSizeM).toBe(stay.fundSizeM);
    expect(fund.offerProfile).toBeUndefined();
  });
});

describe('mega fund', () => {
  it('is offered only after a 1x+ fund, drops a rung, and the ladder climbs from there', () => {
    const career = { ...careerForTier('partner'), lastFundDpi: 1.3 };
    const seed = [...Array(200).keys()].find((s) => offerProfileFor(career, s) === 'megaFund')!;
    const run = createRun(career, seed, ec);
    expect(run.tier).toBe('associate');
    expect(run.fundSizeM).toBeCloseTo(career.nextFundSizeM! * OFFER_PROFILES.megaFund.sizeMult, 0);
    const done = simulateRun(career, seed, ec);
    done.harvest = { ...done.harvest!, dpi: 1.1 };
    const next = closeCareerFund(career, done, createRng(1), content.theses);
    expect(next.tier).toBe('partner'); // associate at 1x+ → partner again
    expect(next.ledger.at(-1)!.tier).toBe('associate');
    expect(eligibleOfferProfiles(career)).toEqual(['dealFlow', 'lpDarling', 'megaFund']);
    const noMega = { ...careerForTier('partner'), lastFundDpi: 0.7 };
    expect([...Array(200).keys()].some((s) => offerProfileFor(noMega, s) === 'megaFund')).toBe(false);
  });
});
