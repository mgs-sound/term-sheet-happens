import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { createRun, meetingsForCareer } from './engine';
import { pickFirmOptions } from './firmOptions';
import { careerForTier } from './sim';
import { OFFER_PROFILES } from './tuning';
import { OFFER_PROFILES_ORDER } from './types';
import { initialCareer } from './career';
import { offerSwingFor } from './fundTerms';
import { outsideSummary } from './rehire';

const content = loadContent();
const ec = { pitches: content.pitches, theses: content.theses, firmNames: content.firmNames };

describe('Fund II+ offer profiles', () => {
  it('offers one of each profile, in order, each bending the same base', () => {
    for (const tier of ['associate', 'partner', 'gp'] as const) {
      const career = careerForTier(tier);
      const seeds = pickFirmOptions(career, ec, 12345);
      const runs = seeds.map((s) => createRun(career, s, ec));
      // careerForTier has no last fund on record, so no mega fund here.
      expect(runs.map((r) => r.offerProfile)).toEqual(OFFER_PROFILES_ORDER.filter((p) => p !== 'megaFund'));
      const baseM = career.nextFundSizeM!;
      for (const r of runs) {
        const p = OFFER_PROFILES[r.offerProfile!];
        const swing = offerSwingFor(career, r.seed);
        expect(Math.abs(r.fundSizeM - baseM * p.sizeMult * swing.sizeMult)).toBeLessThanOrEqual(0.05 + 1e-9); // roundM: 0.1M steps
        expect(r.meetingsTotal).toBe(Math.round(meetingsForCareer(career) * p.meetingsMult));
        expect(r.lpTrust).toBe(Math.min(100, Math.max(0, career.lpTrust + p.trustDelta + swing.trustDelta)));
      }
    }
  });

  it('the swing stays inside the range the inbox shows', () => {
    for (const tier of ['associate', 'partner', 'gp'] as const) {
      const career = careerForTier(tier);
      const out = outsideSummary(career);
      for (let seed = 1; seed < 200; seed++) {
        const r = createRun(career, seed, ec);
        expect(r.fundSizeM).toBeGreaterThanOrEqual(out.fundLowM - 0.05);
        expect(r.fundSizeM).toBeLessThanOrEqual(out.fundHighM + 0.05);
        expect(r.lpTrust).toBeGreaterThanOrEqual(out.trustLow);
        expect(r.lpTrust).toBeLessThanOrEqual(out.trustHigh);
      }
    }
  });

  it('does not apply to Fund I or to a GP LP package', () => {
    expect(createRun(initialCareer(), 7, ec).offerProfile).toBeUndefined();
    const gp = { ...careerForTier('gp'), pendingFund: { sizeM: 222, thesisId: content.theses[0]!.id, quirkIndex: 0 } };
    const run = createRun(gp, 7, ec);
    expect(run.offerProfile).toBeUndefined();
    expect(run.fundSizeM).toBe(222);
  });
});
