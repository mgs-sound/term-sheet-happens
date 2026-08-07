/**
 * Negotiation (Fund II+): founder acceptance model, counter generation, and
 * the entry-price exit bonus. Pure functions; the reducer owns the rolls.
 */

import type { RNG } from './rng.ts';
import type { NegotiationState, PitchCard } from './types.ts';
import { ACCEPTANCE, BOARD_SEATS, NEGOTIATION } from './tuning.ts';
import { clamp, lerp, roundM } from './util.ts';

export interface Offer {
  checkM: number;
  valuationM: number;
  boardSeat: boolean;
}

/** Legal slider ranges for an offer on this card. */
export function offerBounds(card: PitchCard): {
  checkMinM: number;
  checkMaxM: number;
  valMinM: number;
  valMaxM: number;
} {
  const b = NEGOTIATION.offerBounds;
  return {
    checkMinM: roundM(card.askM * b.checkMinRatio),
    checkMaxM: roundM(card.askM * b.checkMaxRatio),
    valMinM: roundM(card.valuationM * b.valMinRatio),
    valMaxM: roundM(card.valuationM * b.valMaxRatio),
  };
}

/**
 * Founder acceptance probability. Monotonic: raising the offered valuation
 * or check never lowers it (all offer weights are positive).
 */
export function acceptanceProbability(
  card: PitchCard,
  offer: Offer,
  round: 0 | 1,
): number {
  const valRatio = offer.valuationM / card.valuationM;
  const checkRatio = offer.checkM / card.askM;
  let p =
    ACCEPTANCE.base +
    ACCEPTANCE.valWeight * (valRatio - 1) +
    ACCEPTANCE.checkWeight * (checkRatio - 1) -
    ACCEPTANCE.heatPenaltyPerPoint * (card.heat - ACCEPTANCE.heatNeutral);
  if (offer.boardSeat) p -= BOARD_SEATS.acceptancePenalty;
  if (round === 1) p += ACCEPTANCE.counterBonus;
  return clamp(p, ACCEPTANCE.min, ACCEPTANCE.max);
}

/** An offer at or above a standing counter is accepted outright. */
export function meetsCounter(offer: Offer, negotiation: NegotiationState): boolean {
  if (!negotiation.counter) return false;
  return (
    offer.checkM >= negotiation.counter.checkM &&
    offer.valuationM >= negotiation.counter.valuationM
  );
}

/** Founder's counter: partway back toward the ask; heat firms it up. */
export function makeCounter(
  card: PitchCard,
  offer: Offer,
): { checkM: number; valuationM: number } {
  const firmness = clamp(
    NEGOTIATION.counterFirmness +
      NEGOTIATION.counterHeatFirmnessPerPoint * (card.heat - ACCEPTANCE.heatNeutral),
    NEGOTIATION.counterFirmnessMin,
    NEGOTIATION.counterFirmnessMax,
  );
  return {
    checkM: roundM(lerp(offer.checkM, card.askM, firmness)),
    valuationM: roundM(lerp(offer.valuationM, card.valuationM, firmness)),
  };
}

/** Lowball offers risk an immediate walk instead of a counter. */
export function rollLowballWalk(rng: RNG, card: PitchCard, offer: Offer): boolean {
  const valRatio = offer.valuationM / card.valuationM;
  if (valRatio >= NEGOTIATION.lowballValRatio) return false;
  return rng.chance(NEGOTIATION.lowballWalkChance);
}

/**
 * Entry-price exit bonus: (askedVal / dealVal)^exponent, capped. Signing at
 * ask gives exactly 1; a negotiated discount scales every future payout up.
 */
export function entryBonus(askedValM: number, dealValM: number): number {
  const raw = Math.pow(askedValM / dealValM, NEGOTIATION.entryBonusExponent);
  return clamp(raw, NEGOTIATION.entryBonusMin, NEGOTIATION.entryBonusMax);
}
