import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { highLowWinChance, reduce } from './engine';
import { initialCareer } from './career';
import { forceVetoChallenge } from './devtools';
import type { GameState } from './types';

const content = loadContent();

function highLowAt(seed: number): GameState | null {
  const s = reduce(null, { type: 'START_RUN', career: initialCareer(), seed, content });
  if (!s.currentCard || s.currentCard.askM > s.capitalM) return null;
  return forceVetoChallenge(s, 'highLow');
}

describe('partner higher/lower challenge', () => {
  it('odds follow the shown card (no ties)', () => {
    expect(highLowWinChance(2, 'higher')).toBe(1);
    expect(highLowWinChance(14, 'higher')).toBe(0);
    expect(highLowWinChance(8, 'higher')).toBe(0.5);
    expect(highLowWinChance(4, 'higher')).toBeCloseTo(10 / 12);
  });

  it('the revealed card is consistent with the verdict and never ties', () => {
    for (let seed = 1; seed < 400; seed++) {
      const s = highLowAt(seed);
      if (!s) continue;
      for (const call of ['higher', 'lower'] as const) {
        const o = reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call });
        const r = o.lastHighLow!;
        expect(r.hidden.rank).not.toBe(r.shown.rank);
        expect(r.hidden.suit).toBe(r.shown.suit); // dealt from one suit
        const wentHigher = r.hidden.rank > r.shown.rank;
        expect(r.won).toBe(call === 'higher' ? wentHigher : !wentHigher);
        expect(o.resolution).toBe(r.won ? 'signed' : 'vetoed');
      }
    }
  });

  it('smart play wins about as often as the odds say', () => {
    let wins = 0;
    let expected = 0;
    let n = 0;
    for (let seed = 1; seed < 4000; seed++) {
      const s = highLowAt(seed);
      if (!s) continue;
      const shown = s.vetoChallenge!.shown!.rank;
      const call = shown <= 8 ? 'higher' : 'lower';
      const o = reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call });
      n++;
      expected += highLowWinChance(shown, call);
      if (o.lastHighLow!.won) wins++;
    }
    expect(Math.abs(wins - expected) / n).toBeLessThan(0.03);
  });

  it('rejects a coin call on a higher/lower round', () => {
    const s = highLowAt(5) ?? highLowAt(6)!;
    expect(() => reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call: 'heads' })).toThrow();
  });
});
