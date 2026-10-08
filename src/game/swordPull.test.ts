import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { reduce, swordTargetTaps } from './engine';
import { offerBounds } from './negotiation';
import { careerForTier } from './sim';
import { SWORD_PULL } from './tuning';
import type { GameState } from './types';

const content = loadContent();

/** Negotiate the first affordable card down to a counter, as `tier`. */
function atCounter(tier: 'associate' | 'partner'): GameState | null {
  for (let seed = 1; seed < 400; seed++) {
    let s = reduce(null, { type: 'START_RUN', career: careerForTier(tier), seed, content });
    const card = s.currentCard;
    if (!card || card.askM > s.capitalM) continue;
    s = reduce(s, { type: 'OPEN_NEGOTIATION' });
    const b = offerBounds(card);
    // A middling lowball: likely countered, not walked.
    const offer = { checkM: card.askM, valuationM: (card.valuationM + b.valMinM) / 2, boardSeat: false };
    s = reduce(s, { type: 'SEND_OFFER', ...offer });
    if (s.phase === 'negotiation' && s.negotiation?.counter) return s;
  }
  return null;
}

function finalBelowCounter(s: GameState): GameState {
  const card = s.currentCard!;
  const b = offerBounds(card);
  return reduce(s, {
    type: 'SEND_OFFER',
    checkM: card.askM,
    valuationM: Math.max(b.valMinM, s.negotiation!.counter!.valuationM * 0.9),
    boardSeat: false,
  });
}

describe('sword in the stone (Partner+ final offer)', () => {
  it('maps acceptance to taps: fair offers are easier', () => {
    expect(swordTargetTaps(1)).toBe(SWORD_PULL.tapsAtCertain);
    expect(swordTargetTaps(0)).toBe(SWORD_PULL.tapsAtHopeless);
    expect(swordTargetTaps(0.5)).toBeGreaterThanOrEqual(35);
    expect(swordTargetTaps(0.5)).toBeLessThanOrEqual(40);
  });

  it('a Partner final offer under the counter parks a sword pull; enough taps sign it', () => {
    const s = atCounter('partner');
    expect(s).not.toBeNull();
    const parked = finalBelowCounter(s!);
    expect(parked.phase).toBe('swordPull');
    const target = parked.swordPull!.targetTaps;
    const won = reduce(parked, { type: 'RESOLVE_SWORD_PULL', taps: target });
    expect(won.resolution).toBe('signed');
    expect(won.lastSwordPull?.won).toBe(true);
    const lost = reduce(parked, { type: 'RESOLVE_SWORD_PULL', taps: target - 1 });
    expect(lost.resolution).toBe('founderWalked');
    expect(lost.portfolio).toHaveLength(0);
  });

  it('Associates still roll the dice', () => {
    const s = atCounter('associate');
    expect(s).not.toBeNull();
    expect(finalBelowCounter(s!).phase).not.toBe('swordPull');
  });
});
