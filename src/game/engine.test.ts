import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { reduce } from './engine';
import { initialCareer } from './career';
import { simulateRun, careerForTier } from './sim';
import { reputationStage } from './meters';
import { METERS } from './tuning';
import type { Action, GameState } from './types';

const content = loadContent();

function start(seed: number, tier: Parameters<typeof careerForTier>[0] = 'fundI'): GameState {
  return reduce(null, { type: 'START_RUN', career: careerForTier(tier), seed, content });
}

describe('engine reducer', () => {
  it('replays identically: same seed + same action sequence = same state', () => {
    const play = (): GameState => simulateRun(initialCareer(), 909, content);
    expect(play()).toEqual(play());
  });

  it('different seeds produce different runs', () => {
    const a = simulateRun(initialCareer(), 1, content);
    const b = simulateRun(initialCareer(), 2, content);
    expect(a.harvest).not.toEqual(b.harvest);
  });

  it('does not mutate the input state', () => {
    const s0 = start(5);
    const frozen = structuredClone(s0);
    reduce(s0, { type: 'PASS' });
    expect(s0).toEqual(frozen);
  });

  it('rejects Fund I negotiation and out-of-phase actions', () => {
    const s0 = start(7);
    expect(() => reduce(s0, { type: 'OPEN_NEGOTIATION' })).toThrow(/sign-at-ask/);
    expect(() => reduce(s0, { type: 'ADVANCE' })).toThrow();
    expect(() => reduce(s0, { type: 'HARVEST' })).toThrow();
  });

  it('supports the negotiation round trip on Fund II+', () => {
    let s = start(11, 'partner');
    // Find a card and open negotiation on it.
    while (s.phase !== 'negotiation') {
      if (s.phase === 'meeting' && s.currentCard && s.resolution === null) {
        s = reduce(s, { type: 'OPEN_NEGOTIATION' });
      } else if (s.phase === 'meeting' && s.resolution !== null) {
        s = reduce(s, { type: 'ADVANCE' });
      } else {
        throw new Error(`unexpected phase ${s.phase}`);
      }
    }
    const card = s.currentCard!;
    // A maximally generous offer at the ask is very likely accepted; either
    // way the state machine must land back in 'meeting' with a resolution.
    s = reduce(s, {
      type: 'SEND_OFFER',
      checkM: card.askM,
      valuationM: card.valuationM,
    });
    if (s.negotiation) {
      s = reduce(s, { type: 'WALK_AWAY' });
    }
    expect(s.phase).toBe('meeting');
    expect(s.resolution).not.toBeNull();
  });

  it('keeps meters clamped to 0..100 through entire runs', () => {
    for (const seed of [3, 33, 333]) {
      for (const tier of ['fundI', 'associate', 'gp'] as const) {
        const final = simulateRun(careerForTier(tier), seed, content);
        expect(final.reputation).toBeGreaterThanOrEqual(METERS.min);
        expect(final.reputation).toBeLessThanOrEqual(METERS.max);
        expect(final.lpTrust).toBeGreaterThanOrEqual(METERS.min);
        expect(final.lpTrust).toBeLessThanOrEqual(METERS.max);
        expect(final.capitalM).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('maps reputation to 5 stages with clamping at the edges', () => {
    expect(reputationStage(0)).toBe(0);
    expect(reputationStage(24)).toBe(0);
    expect(reputationStage(25)).toBe(1);
    expect(reputationStage(74)).toBe(2);
    expect(reputationStage(75)).toBe(3);
    expect(reputationStage(100)).toBe(4);
  });

  it('accounts capital exactly: fund = remaining + invested', () => {
    const final = simulateRun(careerForTier('associate'), 77, content);
    const invested = final.portfolio.reduce((sum, c) => sum + c.investedM, 0);
    const eaten = final.events
      .filter((e) => e.kind === 'capitalCallEaten')
      .reduce((sum, e) => sum + (e.amountM ?? 0), 0);
    expect(final.capitalM + invested + eaten).toBeCloseTo(final.fundSizeM, 6);
  });

  it('harvest DPI equals returned / fund size and is deterministic', () => {
    const final = simulateRun(careerForTier('gp'), 4242, content);
    expect(final.harvest).not.toBeNull();
    expect(final.harvest!.dpi).toBeCloseTo(final.harvest!.returnedM / final.fundSizeM, 10);
  });

  it('honors a GP-chosen firm name without perturbing the rng stream', () => {
    const named = {
      ...careerForTier('gp'),
      pendingFirmName: 'House of Sand & Fog Capital',
    };
    const a = reduce(null, { type: 'START_RUN', career: named, seed: 5, content });
    const b = reduce(null, { type: 'START_RUN', career: careerForTier('gp'), seed: 5, content });
    expect(a.firmName).toBe('House of Sand & Fog Capital');
    expect(a.deck).toEqual(b.deck); // same seed, same deck, name aside
  });

  it('portfolio company ids stay unique even when the deck repeats a pitch', () => {
    for (const seed of [7, 77, 777]) {
      const final = simulateRun(careerForTier('partner'), seed, content);
      const ids = final.portfolio.map((c) => c.companyId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('Fund I never surfaces interrupts', () => {
    const final = simulateRun(initialCareer(), 55, content);
    const kinds = new Set(final.events.map((e) => e.kind));
    expect(kinds.has('followOnTaken')).toBe(false);
    expect(kinds.has('followOnDeclined')).toBe(false);
    expect(kinds.has('bridgeTaken')).toBe(false);
    expect(kinds.has('capitalCallEaten')).toBe(false);
  });
});

describe('serializability', () => {
  it('GameState round-trips through JSON', () => {
    let s = start(21);
    const actions: Action[] = [{ type: 'PASS' }, { type: 'ADVANCE' }];
    for (const a of actions) s = reduce(s, a);
    const revived = JSON.parse(JSON.stringify(s)) as GameState;
    expect(revived).toEqual(s);
    // And the revived state keeps reducing identically.
    expect(reduce(revived, { type: 'PASS' })).toEqual(reduce(s, { type: 'PASS' }));
  });
});
