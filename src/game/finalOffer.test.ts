import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { reduce, swordTargetTaps, wheelAngleAt, wheelHits, wheelSliceDeg } from './engine';
import { offerBounds } from './negotiation';
import { careerForTier } from './sim';
import { SWORD_PULL, WHEEL, WHEEL_VISIBLE_MS } from './tuning';
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

  it('a Partner final offer under the counter parks a minigame that settles it', () => {
    const s = atCounter('partner');
    expect(s).not.toBeNull();
    const parked = finalBelowCounter(s!);
    expect(parked.phase).toBe('finalOffer');
    const c = { ...parked.finalOffer! };
    // Sword: enough taps sign it, one short and the founder walks.
    const sword = { ...parked, finalOffer: { ...c, game: 'sword' as const } };
    const won = reduce(sword, { type: 'RESOLVE_SWORD_PULL', taps: c.targetTaps });
    expect(won.resolution).toBe('signed');
    expect(won.lastFinalOffer?.won).toBe(true);
    const lost = reduce(sword, { type: 'RESOLVE_SWORD_PULL', taps: c.targetTaps - 1 });
    expect(lost.resolution).toBe('founderWalked');
    expect(lost.portfolio).toHaveLength(0);
    // Wheel: stopping with the slice under the pointer signs it.
    const wheel = { ...parked, finalOffer: { ...c, game: 'wheel' as const } };
    // After the visible turns (whole turns: same angle), then on to the top.
    const toTop = WHEEL_VISIBLE_MS + (((360 - c.startDeg) % 360) / WHEEL.degPerSec) * 1000;
    expect(reduce(wheel, { type: 'RESOLVE_WHEEL', elapsedMs: toTop }).resolution).toBe('signed');
    const miss = toTop + ((c.sliceDeg / 2 + 20) / WHEEL.degPerSec) * 1000;
    expect(reduce(wheel, { type: 'RESOLVE_WHEEL', elapsedMs: miss }).resolution).toBe('founderWalked');
  });

  it('wheel: a STOP before the cover drops counts as the moment it drops', () => {
    const s = atCounter('partner')!;
    const parked = finalBelowCounter(s);
    const wheel = { ...parked, finalOffer: { ...parked.finalOffer!, game: 'wheel' as const } };
    const early = reduce(wheel, { type: 'RESOLVE_WHEEL', elapsedMs: 10 });
    const atDrop = reduce(wheel, { type: 'RESOLVE_WHEEL', elapsedMs: WHEEL_VISIBLE_MS });
    expect(early.lastFinalOffer?.stopDeg).toBe(atDrop.lastFinalOffer?.stopDeg);
  });

  it('wheel: slice widens with acceptance; hits are symmetric around the pointer', () => {
    expect(wheelSliceDeg(0)).toBe(WHEEL.sliceDegAtHopeless);
    expect(wheelSliceDeg(1)).toBe(WHEEL.sliceDegAtCertain);
    expect(wheelHits(10, 30)).toBe(true);
    expect(wheelHits(350, 30)).toBe(true);
    expect(wheelHits(20, 30)).toBe(false);
    expect(wheelHits(wheelAngleAt(100, (260 / WHEEL.degPerSec) * 1000), 2)).toBe(true);
  });

  it('Associates still roll the dice', () => {
    const s = atCounter('associate');
    expect(s).not.toBeNull();
    expect(finalBelowCounter(s!).phase).not.toBe('finalOffer');
  });
});
