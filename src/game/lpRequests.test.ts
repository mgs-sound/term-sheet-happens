import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { initialCareer } from './career';
import { createRun, reduce } from './engine';
import { rollLpRequests, settleLpRequests, updateLiveLpRequests } from './lpRequests';
import { LP_REQUESTS } from './tuning';
import type { GameState, PortfolioCompany } from './types';

const content = loadContent();
const engineContent = { pitches: content.pitches, theses: content.theses, firmNames: content.firmNames };

let nextId = 0;
function company(onThesis: boolean, investedM: number): PortfolioCompany {
  const run = createRun(initialCareer(), 1, engineContent);
  const card = { ...run.deck[0]!, onThesis };
  return {
    companyId: `c${nextId++}`,
    card,
    investedM,
    initialCheckM: investedM,
    dealValuationM: card.valuationM,
    ownership: 0.1,
    entryBonus: 1,
    boardSeat: false,
    signedAtMeeting: 0,
    followOnEvents: 0,
    bridged: false,
    status: 'active',
  };
}

function runWith(kinds: GameState['lpRequests']): GameState {
  return { ...createRun(initialCareer(), 7, engineContent), lpRequests: kinds, portfolio: [] };
}

describe('rollLpRequests', () => {
  it('rolls 1..3 distinct requests, deterministic per seed', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed < 300; seed++) {
      const a = rollLpRequests(seed, false);
      expect(a).toEqual(rollLpRequests(seed, false));
      expect(a.length).toBeGreaterThanOrEqual(LP_REQUESTS.minCount);
      expect(a.length).toBeLessThanOrEqual(LP_REQUESTS.maxCount);
      expect(new Set(a.map((r) => r.kind)).size).toBe(a.length);
      expect(a.every((r) => r.status === 'open')).toBe(true);
      counts.add(a.length);
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
  });

  it('never asks Fund I for a unicorn', () => {
    for (let seed = 1; seed < 300; seed++) {
      expect(rollLpRequests(seed, true).some((r) => r.kind === 'unicorn')).toBe(false);
    }
  });

  it('does not change the run itself (salted stream)', () => {
    const run = createRun(initialCareer(), 42, engineContent);
    const { lpRequests: _ignored, ...rest } = run;
    const again = createRun(initialCareer(), 42, engineContent);
    const { lpRequests: _ignored2, ...restAgain } = again;
    expect(rest).toEqual(restAgain);
    expect(run.lpRequests?.length).toBeGreaterThan(0);
  });
});

describe('live + harvest settling', () => {
  it('breaks "stay on thesis" the moment an off-thesis check lands', () => {
    const s = runWith([{ kind: 'onThesis', status: 'open', lineIndex: 0 }]);
    s.portfolio.push(company(true, 1));
    expect(updateLiveLpRequests(s)).toEqual([]);
    s.portfolio.push(company(false, 1));
    expect(updateLiveLpRequests(s)).toEqual(['onThesis']);
    expect(s.lpRequests?.[0]?.status).toBe('broken');
    expect(updateLiveLpRequests(s)).toEqual([]); // breaks once
  });

  it('breaks "dry powder" past the deployment cap, including follow-ons', () => {
    const s = runWith([{ kind: 'dryPowder', status: 'open', lineIndex: 0 }]);
    const cap = s.fundSizeM * LP_REQUESTS.dryPowderMaxDeployed;
    s.portfolio.push(company(true, cap));
    expect(updateLiveLpRequests(s)).toEqual([]); // exactly at the cap is fine
    s.portfolio[0]!.investedM += 0.1; // a pro rata top-up
    expect(updateLiveLpRequests(s)).toEqual(['dryPowder']);
  });

  it('settles at harvest: unicorn / return the fund / empty funds fail', () => {
    const s = runWith([
      { kind: 'onThesis', status: 'open', lineIndex: 0 },
      { kind: 'unicorn', status: 'open', lineIndex: 0 },
      { kind: 'returnFund', status: 'open', lineIndex: 0 },
    ]);
    s.harvest = { companies: [], returnedM: 0, dpi: 1.2, unicorns: 1, vetoedUnicorns: 0, visionaries: 0 };
    // No investments: staying on thesis by staying home doesn't count.
    expect(settleLpRequests(s)).toBe(2);
    expect(s.lpRequests?.map((r) => r.status)).toEqual(['broken', 'met', 'met']);
  });

  it('pays LP trust per request met at harvest, through the reducer', () => {
    let s = createRun(initialCareer(), 3, engineContent);
    s = { ...s, lpRequests: [{ kind: 'dryPowder', status: 'open', lineIndex: 0 }] };
    // Sign the first deal, then pass the rest.
    s = reduce(s, { type: 'SIGN_AT_ASK' });
    while (s.phase !== 'fundClosed') {
      if (s.phase === 'vetoChallenge') s = reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call: 'heads' as const });
      else if (s.resolution !== null) s = reduce(s, { type: 'ADVANCE' });
      else if (s.phase === 'interrupt') s = reduce(s, { type: 'RESOLVE_INTERRUPT', accept: false });
      else if (s.currentCard) s = reduce(s, { type: 'PASS' });
      else s = reduce(s, { type: 'CLOSE_FUND' });
    }
    const before = s.lpTrust;
    expect(s.lpRequests![0]!.status).not.toBe('met'); // met only at harvest
    const harvested = reduce(s, { type: 'HARVEST' });
    const status = harvested.lpRequests![0]!.status;
    expect(status).not.toBe('open');
    const bonus = status === 'met' ? LP_REQUESTS.metTrustDelta : 0;
    expect(harvested.lpTrust).toBe(Math.min(100, before + bonus));
  });
});
