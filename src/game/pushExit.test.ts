import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { reduce } from './engine';
import { careerForTier } from './sim';
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

describe('board-seat exit push (TOGGLE_PUSH_EXIT)', () => {
  it('toggles on and off for a board-seat company, without touching the RNG', () => {
    const s = signedWithSeat();
    const id = s.portfolio[0]!.companyId;
    const on = reduce(s, { type: 'TOGGLE_PUSH_EXIT', companyId: id });
    expect(on.portfolio[0]!.pushExit).toBe(true);
    expect(on.rngState >>> 0).toBe(s.rngState >>> 0); // same stream position
    const off = reduce(on, { type: 'TOGGLE_PUSH_EXIT', companyId: id });
    expect(off.portfolio[0]!.pushExit).toBe(false);
  });

  it('rejects companies without a board seat', () => {
    const s = signedWithSeat();
    const noSeat = structuredClone(s);
    noSeat.portfolio[0]!.boardSeat = false;
    expect(() =>
      reduce(noSeat, { type: 'TOGGLE_PUSH_EXIT', companyId: noSeat.portfolio[0]!.companyId }),
    ).toThrow(/no board seat/);
  });

  it('harvest applies the in-run push (improved or zeroed, never untouched)', () => {
    const s = signedWithSeat();
    const id = s.portfolio[0]!.companyId;
    const pushed = reduce(s, { type: 'TOGGLE_PUSH_EXIT', companyId: id });
    const closed = { ...structuredClone(pushed), phase: 'fundClosed' as const };
    const h = reduce(closed, { type: 'HARVEST' });
    const result = h.harvest!.companies.find((c) => c.companyId === id)!;
    if (result.bucket !== 'zero' || result.boardPush) {
      expect(['improved', 'zeroed']).toContain(result.boardPush);
    }
  });
});
