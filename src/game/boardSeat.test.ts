import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { reduce } from './engine';
import { careerForTier } from './sim';
import { BOARD_SEATS } from './tuning';
import type { GameState } from './types';

const content = loadContent();

/** A Partner run where the first card was signed at ask WITH a board seat. */
function signedWithSeat(): GameState {
  for (let seed = 1; seed < 500; seed++) {
    const s0 = reduce(null, { type: 'START_RUN', career: careerForTier('partner'), seed, content });
    const card = s0.currentCard;
    if (!card || card.askM > s0.capitalM) continue;
    const s1 = reduce(s0, { type: 'SIGN_AT_ASK', boardSeat: true });
    if (s1.resolution === 'signed') return s1;
  }
  throw new Error('no seed produced a board-seat signing');
}

function harvestOnce(s: GameState, k: number, quality: number, seat: boolean) {
  const x = structuredClone(s);
  x.portfolio[0]!.card.quality = quality;
  x.portfolio[0]!.boardSeat = seat;
  const closed = { ...x, phase: 'fundClosed' as const, rngState: (x.rngState + k * 7919) >>> 0 };
  return reduce(closed, { type: 'HARVEST' }).harvest!;
}

describe('board seat at harvest', () => {
  it('signing at ask with a seat never spooks the founder', () => {
    for (let seed = 1; seed < 200; seed++) {
      const s0 = reduce(null, { type: 'START_RUN', career: careerForTier('partner'), seed, content });
      if (!s0.currentCard || s0.currentCard.askM > s0.capitalM) continue;
      const s1 = reduce(s0, { type: 'SIGN_AT_ASK', boardSeat: true });
      expect(s1.resolution).not.toBe('founderWalked');
    }
  });

  it('same roll: a seat multiplies an exit, and turns a zero into a liability', () => {
    const s = signedWithSeat();
    let bonuses = 0;
    let liabilities = 0;
    for (let k = 0; k < 300; k++) {
      const without = harvestOnce(s, k, 0.5, false).companies[0]!;
      const withSeat = harvestOnce(s, k, 0.5, true).companies[0]!;
      expect(withSeat.bucket).toBe(without.bucket); // the seat never changes the outcome
      if (without.bucket === 'zero') {
        expect(withSeat.boardSeat).toBe('liability');
        expect(withSeat.proceedsM).toBeCloseTo(-withSeat.investedM * BOARD_SEATS.zeroPenalty, 1);
        liabilities += 1;
      } else {
        expect(withSeat.boardSeat).toBe('bonus');
        expect(withSeat.proceedsM).toBeCloseTo(without.proceedsM * BOARD_SEATS.exitMult, 0);
        bonuses += 1;
      }
    }
    expect(bonuses).toBeGreaterThan(0);
    expect(liabilities).toBeGreaterThan(0);
  });

});

describe('career ended in legal fees', () => {
  it('a fund in the red ends the career and is the ledger last line', async () => {
    const { careerEnded, closeCareerFund } = await import('./career');
    const { createRng } = await import('./rng');
    const s = signedWithSeat();
    let found = false;
    for (let k = 0; k < 200 && !found; k++) {
      const x = structuredClone(s);
      x.portfolio[0]!.card.quality = 0;
      const h = reduce({ ...x, phase: 'fundClosed', rngState: (x.rngState + k * 7919) >>> 0 }, { type: 'HARVEST' });
      if (h.harvest!.returnedM < 0) {
        found = true;
        expect(careerEnded(h)).toBe(true);
        const next = closeCareerFund(careerForTier('partner'), h, createRng(1), content.theses);
        expect(next.ledger.at(-1)!.careerEnded).toBe(true);
      }
    }
    expect(found).toBe(true);
  });
});
