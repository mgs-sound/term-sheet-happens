/**
 * Dev-only helpers for the ?dev cheat panel and tests. Pure functions on
 * engine state — the UI never edits game state by hand, even when cheating.
 * Nothing here is reachable from normal play.
 */

import type { CareerState, ChallengeGame, GameState } from './types.ts';
import { drawCard } from './engine.ts';
import { createRng } from './rng.ts';
import { initialCareer } from './career.ts';
import { METERS } from './tuning.ts';
import { clamp, roundM } from './util.ts';

/** Rewrite a harvested run's headline numbers (DPI, fund size, reputation). */
export function forceHarvestResult(
  state: GameState,
  opts: { dpi: number; fundSizeM?: number; reputation?: number },
): GameState {
  if (state.phase !== 'harvested' || !state.harvest) {
    throw new Error('forceHarvestResult: run is not harvested');
  }
  const s = structuredClone(state) as GameState;
  const harvest = s.harvest;
  if (!harvest) throw new Error('forceHarvestResult: run is not harvested');
  if (opts.fundSizeM !== undefined) s.fundSizeM = opts.fundSizeM;
  if (opts.reputation !== undefined) {
    s.reputation = clamp(opts.reputation, METERS.min, METERS.max);
  }
  harvest.dpi = opts.dpi;
  harvest.returnedM = roundM(opts.dpi * s.fundSizeM);
  return s;
}

/**
 * Throw the partner's coin-flip challenge on the current card right now, at
 * the asked terms — for feeling out the interaction without fishing for a
 * natural veto (1 in 3 of a 15–65% roll).
 */
export function forceVetoChallenge(
  state: GameState,
  game: ChallengeGame = 'coin',
): GameState {
  const card = state.currentCard;
  if (state.phase !== 'meeting' || !card || state.resolution !== null) {
    throw new Error('forceVetoChallenge: needs an open meeting card');
  }
  if (card.askM > state.capitalM) {
    throw new Error('forceVetoChallenge: the ask exceeds dry powder');
  }
  const s = structuredClone(state) as GameState;
  s.phase = 'vetoChallenge';
  const terms = { checkM: card.askM, dealValuationM: card.valuationM, boardSeat: false };
  // Shown card from a side RNG so cheating never shifts the run's main stream.
  s.vetoChallenge =
    game === 'highLow'
      ? { ...terms, game, shown: drawCard(createRng((state.rngState ^ 0xc0ffee) >>> 0)) }
      : { ...terms, game };
  s.negotiation = null;
  return s;
}

/** A GP career one great fund away from Enlightenment. */
export function careerAtEnlightenmentGate(): CareerState {
  return {
    ...initialCareer(),
    tier: 'gp',
    fundIndex: 5,
    reputation: 92,
    lpTrust: 85,
    aumM: 640,
    totalReturnedM: 410,
    bestDpi: 2.6,
    lastFundDpi: 2.6,
    nextFundSizeM: 260,
  };
}
