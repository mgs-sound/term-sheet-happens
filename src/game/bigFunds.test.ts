import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { createRun } from './engine';
import { bigFundTerms, offerProfileFor } from './fundTerms';
import { rollLpRequests } from './lpRequests';
import { careerForTier } from './sim';
import { BIG_FUNDS, LP_REQUESTS } from './tuning';

const content = loadContent();
const ec = { pitches: content.pitches, theses: content.theses, firmNames: content.firmNames };

describe('big funds', () => {
  it('never scales a normal fund down; scales with money per meeting', () => {
    expect(bigFundTerms(10, 25, 'associate').checkScale).toBe(1);
    const ref = BIG_FUNDS.refPerMeetingM.gp;
    expect(bigFundTerms(ref * 40 * 2, 40, 'gp').checkScale).toBeCloseTo(2);
    expect(bigFundTerms(ref * 40 * 2, 40, 'gp').pressure).toBe(1);
    expect(bigFundTerms(ref * 40 * 3, 40, 'gp').pressure).toBe(2);
  });

  it('a mega fund is deployable: card asks add up to roughly the fund', () => {
    const career = { ...careerForTier('gp'), lastFundDpi: 1.5 };
    const seeds = [...Array(300).keys()].filter((s) => offerProfileFor(career, s) === 'megaFund');
    expect(seeds.length).toBeGreaterThan(10);
    for (const seed of seeds.slice(0, 10)) {
      const run = createRun(career, seed, ec);
      const asks = run.deck.reduce((sum, c) => sum + c.askM, 0);
      expect(run.checkScale).toBeGreaterThan(1);
      expect(asks / run.fundSizeM).toBeGreaterThan(0.75);
      // ...and its LPs want more, and stricter.
      expect(run.lpRequests!.length).toBeGreaterThanOrEqual(LP_REQUESTS.byPressure[1]!.minCount);
      expect(run.lpRequests!.every((r) => r.strict)).toBe(true);
    }
  });

  it('pressure 2 rolls 4–5 requests, never contradictory', () => {
    for (let seed = 1; seed < 300; seed++) {
      const reqs = rollLpRequests(seed, false, 'gp', 2);
      expect(reqs.length).toBeGreaterThanOrEqual(4);
      expect(reqs.length).toBeLessThanOrEqual(5);
      const kinds = reqs.map((r) => r.kind);
      expect(kinds.includes('onThesis') && kinds.includes('diversify')).toBe(false);
      expect(kinds.includes('dryPowder') && kinds.includes('unicorn')).toBe(false);
    }
  });
});
