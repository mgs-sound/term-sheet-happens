import { describe, expect, it } from 'vitest';
import type { PitchCard } from './types';
import { acceptanceProbability, entryBonus, makeCounter, offerBounds } from './negotiation';
import { NEGOTIATION } from './tuning';

function card(overrides: Partial<PitchCard> = {}): PitchCard {
  return {
    pitchId: 'test-card',
    name: 'Testly',
    idea: 'A test, but venture-scale.',
    sector: 'AI',
    stage: 'seed',
    team: 3,
    traction: 3,
    arrK: 100,
    heat: 3,
    askM: 2,
    valuationM: 12,
    onThesis: true,
    quality: 0.5,
    ...overrides,
  };
}

describe('founder acceptance model', () => {
  it('is monotonic in valuation generosity', () => {
    const c = card();
    let prev = -1;
    for (let val = 7; val <= 13; val += 0.5) {
      const p = acceptanceProbability(c, { checkM: 2, valuationM: val, boardSeat: false }, 0);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('is monotonic in check fit', () => {
    const c = card();
    let prev = -1;
    for (let check = 1; check <= 2.5; check += 0.1) {
      const p = acceptanceProbability(c, { checkM: check, valuationM: 12, boardSeat: false }, 0);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('never rises with heat, and board seats cost acceptance', () => {
    const offer = { checkM: 2, valuationM: 10, boardSeat: false };
    const cool = acceptanceProbability(card({ heat: 1 }), offer, 0);
    const hot = acceptanceProbability(card({ heat: 5 }), offer, 0);
    expect(hot).toBeLessThanOrEqual(cool);

    const seatless = acceptanceProbability(card(), offer, 0);
    const seated = acceptanceProbability(card(), { ...offer, boardSeat: true }, 0);
    expect(seated).toBeLessThan(seatless);
  });

  it('stays a probability across the whole slider range', () => {
    const c = card({ heat: 5 });
    const b = offerBounds(c);
    for (const checkM of [b.checkMinM, b.checkMaxM]) {
      for (const valuationM of [b.valMinM, b.valMaxM]) {
        const p = acceptanceProbability(c, { checkM, valuationM, boardSeat: true }, 0);
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThan(1);
      }
    }
  });
});

describe('counters and entry bonus', () => {
  it('counters land between the offer and the ask', () => {
    const c = card();
    const counter = makeCounter(c, { checkM: 1.5, valuationM: 8, boardSeat: false });
    expect(counter.valuationM).toBeGreaterThan(8);
    expect(counter.valuationM).toBeLessThanOrEqual(c.valuationM);
    expect(counter.checkM).toBeGreaterThan(1.5);
    expect(counter.checkM).toBeLessThanOrEqual(c.askM);
  });

  it('hotter founders counter closer to the ask', () => {
    const offer = { checkM: 1.5, valuationM: 8, boardSeat: false };
    const cool = makeCounter(card({ heat: 1 }), offer);
    const hot = makeCounter(card({ heat: 5 }), offer);
    expect(hot.valuationM).toBeGreaterThan(cool.valuationM);
  });

  it('entry bonus follows (askVal/dealVal)^0.5 and is capped', () => {
    expect(entryBonus(12, 12)).toBeCloseTo(1, 10);
    expect(entryBonus(12, 9)).toBeCloseTo(Math.sqrt(12 / 9), 10);
    expect(entryBonus(12, 1)).toBe(NEGOTIATION.entryBonusMax);
    expect(entryBonus(12, 100)).toBe(NEGOTIATION.entryBonusMin);
  });
});
