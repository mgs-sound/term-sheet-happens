import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { pickChallengeGame, reduce } from './engine';
import { initialCareer } from './career';
import { forceVetoChallenge } from './devtools';
import { createRng } from './rng';
import { STICKS } from './tuning';
import type { ChallengeGame, GameState } from './types';

const content = loadContent();

function challengeAt(seed: number, game: ChallengeGame): GameState | null {
  const s = reduce(null, { type: 'START_RUN', career: initialCareer(), seed, content });
  if (!s.currentCard || s.currentCard.askM > s.capitalM) return null;
  return forceVetoChallenge(s, game);
}

describe('even/odd dice challenge', () => {
  it('the face shown always matches the verdict', () => {
    for (let seed = 1; seed < 400; seed++) {
      const s = challengeAt(seed, 'dice');
      if (!s) continue;
      for (const call of ['even', 'odd'] as const) {
        const o = reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call });
        const d = o.lastDice!;
        expect(d.roll).toBeGreaterThanOrEqual(1);
        expect(d.roll).toBeLessThanOrEqual(6);
        expect(d.won).toBe((d.roll % 2 === 0) === (call === 'even'));
        expect(o.resolution).toBe(d.won ? 'signed' : 'vetoed');
      }
    }
  });
});

describe('longest-stick challenge', () => {
  it('the called stick is longer exactly when you win, by a visible gap', () => {
    for (let seed = 1; seed < 400; seed++) {
      const s = challengeAt(seed, 'sticks');
      if (!s) continue;
      for (const call of ['red', 'green'] as const) {
        const o = reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call });
        const st = o.lastSticks!;
        const mine = call === 'red' ? st.red : st.green;
        const theirs = call === 'red' ? st.green : st.red;
        expect(st.won).toBe(mine > theirs);
        expect(Math.abs(st.red - st.green)).toBeGreaterThanOrEqual(STICKS.minGap);
      }
    }
  });
});

describe('challenge game pick', () => {
  it('spreads across all four minigames', () => {
    const rng = createRng(42);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const g = pickChallengeGame(rng);
      seen[g] = (seen[g] ?? 0) + 1;
    }
    for (const g of ['coin', 'highLow', 'dice', 'sticks']) {
      expect(seen[g]! / 4000).toBeGreaterThan(0.2);
      expect(seen[g]! / 4000).toBeLessThan(0.3);
    }
  });
});
