import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { craneCrossMs, reduce, swordTargetTaps, wheelAngleAt, wheelHits, wheelSliceDeg } from './engine';
import { offerBounds } from './negotiation';
import { careerForTier } from './sim';
import { CRANE, SWORD_PULL, WHEEL, WHEEL_VISIBLE_MS } from './tuning';
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

  it('cranes: three flights (warm-up then fast), one shot each, 2 hits sign it', () => {
    const parked = finalBelowCounter(atCounter('partner')!);
    const c = { ...parked.finalOffer!, game: 'crane' as const };
    const crane = { ...parked, finalOffer: c };
    expect(c.cranes).toHaveLength(3);
    expect(c.cranes[0]!.flightMs).toBeGreaterThan(c.cranes[1]!.flightMs);
    // Every crane teases from its bush first.
    expect(c.cranes.every((cr) => cr.peeksMs.length >= 1)).toBe(true);
    // In order, no overlap: each takes off after the previous one landed.
    for (let i = 1; i < c.cranes.length; i++) {
      const prev = c.cranes[i - 1]!;
      expect(c.cranes[i]!.takeoffMs).toBeGreaterThan(prev.takeoffMs + prev.flightMs);
      expect(c.cranes[i]!.peeksMs.every((p) => p > prev.takeoffMs + prev.flightMs)).toBe(true);
    }
    const cross = c.cranes.map(craneCrossMs);
    const shoot = (shotsMs: (number | null)[]) =>
      reduce(crane, { type: 'RESOLVE_CRANE', shotsMs }).resolution;
    expect(shoot(cross)).toBe('signed');
    expect(shoot([cross[0]!, null, cross[2]! + c.windowMs / 2])).toBe('signed');
    expect(shoot([cross[0]!, null, null])).toBe('founderWalked');
    expect(shoot([cross[0]! - c.windowMs, cross[1]! + c.windowMs, cross[2]!])).toBe('founderWalked');
    expect(CRANE.hitsToWin).toBe(2);
  });

  it('wheel: slice widens with acceptance; hits are symmetric around the pointer', () => {
    expect(wheelSliceDeg(0)).toBe(WHEEL.sliceDegAtHopeless);
    expect(wheelSliceDeg(1)).toBe(WHEEL.sliceDegAtCertain);
    expect(wheelHits(10, 30)).toBe(true);
    expect(wheelHits(350, 30)).toBe(true);
    expect(wheelHits(20, 30)).toBe(false);
    expect(wheelHits(wheelAngleAt(100, (260 / WHEEL.degPerSec) * 1000), 2)).toBe(true);
  });

  it('a won final offer signs outright, even for an Associate (no partner veto on top)', () => {
    const parked = finalBelowCounter(atCounter('partner')!);
    // As if an Associate got here (the dev panel can force one).
    const assoc = { ...parked, tier: 'associate' as const, finalOffer: { ...parked.finalOffer!, game: 'sword' as const } };
    for (let k = 0; k < 40; k++) {
      const s = { ...structuredClone(assoc), rngState: (assoc.rngState + k * 7919) >>> 0 };
      const won = reduce(s, { type: 'RESOLVE_SWORD_PULL', taps: 999 });
      expect(won.phase).toBe('meeting');
      expect(won.resolution).toBe('signed');
    }
  });

  it('Associates still roll the dice', () => {
    const s = atCounter('associate');
    expect(s).not.toBeNull();
    expect(finalBelowCounter(s!).phase).not.toBe('finalOffer');
  });
});
