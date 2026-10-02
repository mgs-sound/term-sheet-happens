import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { reduce } from './engine';
import { initialCareer } from './career';
import type { GameState } from './types';

const content = loadContent();

/** Sign at ask through Fund I meetings until the partner throws a coin-flip challenge. */
function findChallenge(): GameState {
  for (let seed = 1; seed < 400; seed++) {
    let s = reduce(null, { type: 'START_RUN', career: initialCareer(), seed, content });
    for (let i = 0; i < 20 && s.currentCard; i++) {
      if (s.currentCard.askM > s.capitalM) break;
      s = reduce(s, { type: 'SIGN_AT_ASK' });
      if (s.phase === 'vetoChallenge' && (s.vetoChallenge?.game ?? 'coin') === 'coin') return s;
      if (s.phase === 'vetoChallenge') break;
      s = reduce(s, { type: 'ADVANCE' });
      if (s.phase !== 'meeting') break;
    }
  }
  throw new Error('no veto challenge found');
}

describe('partner coin-flip veto challenge', () => {
  it('parks the deal: no money moves until the coin lands', () => {
    const s = findChallenge();
    expect(s.vetoChallenge).toBeTruthy();
    expect(s.resolution).toBeNull();
    expect(s.portfolio.some((c) => c.signedAtMeeting === s.meetingIndex)).toBe(false);
    expect(() => reduce(s, { type: 'ADVANCE' })).toThrow();
  });

  it('a win signs the deal; a loss is a normal veto', () => {
    const s = findChallenge();
    const heads = reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call: 'heads' });
    expect(heads.phase).toBe('meeting');
    expect(heads.vetoChallenge).toBeNull();
    const flip = heads.lastCoinFlip!;
    expect(flip.call).toBe('heads');
    expect(flip.won).toBe(flip.landed === 'heads');
    if (flip.won) {
      expect(heads.resolution).toBe('signed');
      expect(heads.capitalM).toBeLessThan(s.capitalM);
    } else {
      expect(heads.resolution).toBe('vetoed');
      expect(heads.capitalM).toBe(s.capitalM);
    }
  });

  it('the coin is fair-ish across many challenges', () => {
    let wins = 0;
    let total = 0;
    for (let seed = 1; seed < 6000 && total < 400; seed++) {
      let s = reduce(null, { type: 'START_RUN', career: initialCareer(), seed, content });
      while (s.currentCard && s.currentCard.askM <= s.capitalM && s.phase === 'meeting') {
        s = reduce(s, { type: 'SIGN_AT_ASK' });
        if (s.phase === 'vetoChallenge') {
          const g = s.vetoChallenge?.game ?? 'coin';
          if (g !== 'coin') {
            const call = g === 'highLow' ? 'higher' : g === 'dice' ? 'even' : 'red';
            s = reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call });
          } else {
            s = reduce(s, { type: 'RESOLVE_VETO_CHALLENGE', call: 'tails' });
            total++;
            if (s.lastCoinFlip!.won) wins++;
          }
        }
        s = reduce(s, { type: 'ADVANCE' });
      }
    }
    expect(total).toBeGreaterThan(30);
    expect(wins / total).toBeGreaterThan(0.4);
    expect(wins / total).toBeLessThan(0.6);
  });
});
