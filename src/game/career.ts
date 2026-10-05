/**
 * Career layer: the ladder between funds. Pure functions over the plain
 * serializable CareerState. Promotion is poaching — every fund is a new firm.
 */

import type { Thesis } from '../content/types.ts';
import type { RNG } from './rng.ts';
import type { CareerState, GameState, LpOffer } from './types.ts';
import { trustSizeMultiplier } from './meters.ts';
import { CAREER, FUND_SIZING, METERS } from './tuning.ts';
import { clamp, roundM } from './util.ts';

export function initialCareer(): CareerState {
  return {
    tier: 'associate',
    fundIndex: 1,
    reputation: METERS.startReputation,
    lpTrust: METERS.startLpTrust,
    aumM: 0,
    totalReturnedM: 0,
    bestDpi: 0,
    lastFundDpi: null,
    unicornsFound: 0,
    vetoedUnicorns: 0,
    enlightened: false,
    endlessUnlocked: false,
    nextFundSizeM: null,
    pendingOffers: null,
    pendingFund: null,
    pendingFirmName: null,
    ledger: [],
  };
}

/** GP vanity: pin the next fund's firm name (null reverts to generated). */
export function withFirmName(career: CareerState, name: string | null): CareerState {
  return { ...career, pendingFirmName: name && name.trim() ? name.trim() : null };
}

function dpiFactor(dpi: number): number {
  return clamp(
    FUND_SIZING.dpiFactorBase + dpi * FUND_SIZING.dpiFactorSlope,
    FUND_SIZING.dpiFactorMin,
    FUND_SIZING.dpiFactorMax,
  );
}

function nextFundSizeM(tierBaseM: number, dpi: number, lpTrust: number): number {
  return roundM(tierBaseM * dpiFactor(dpi) * trustSizeMultiplier(lpTrust));
}

export function generateLpOffers(
  rng: RNG,
  theses: readonly Thesis[],
  targetSizeM: number,
): LpOffer[] {
  const shuffled = rng.shuffle(theses);
  return FUND_SIZING.gpOfferSizeFactors.slice(0, CAREER.gpOfferCount).map((factor, i) => {
    const jitter = rng.float(
      1 - FUND_SIZING.gpOfferSizeJitter,
      1 + FUND_SIZING.gpOfferSizeJitter,
    );
    const thesis = shuffled[i % shuffled.length] as Thesis;
    return {
      fundSizeM: roundM(targetSizeM * factor * jitter),
      thesisId: thesis.id,
      quirkIndex: rng.int(0, 2 ** 30),
    };
  });
}

/**
 * Fold a harvested run into the career: totals, meters, ladder movement,
 * next-fund sizing, Enlightenment. `rng` powers GP offer generation and must
 * be seeded by the caller for determinism.
 */
export function closeCareerFund(
  career: CareerState,
  run: GameState,
  rng: RNG,
  theses: readonly Thesis[],
): CareerState {
  if (run.phase !== 'harvested' || !run.harvest) {
    throw new Error('closeCareerFund: run is not harvested');
  }
  const harvest = run.harvest;
  const dpi = harvest.dpi;

  const next: CareerState = {
    ...career,
    fundIndex: career.fundIndex + 1,
    reputation: run.reputation,
    lpTrust: run.lpTrust,
    aumM: roundM(career.aumM + run.fundSizeM),
    totalReturnedM: roundM(career.totalReturnedM + harvest.returnedM),
    bestDpi: Math.max(career.bestDpi, dpi),
    lastFundDpi: dpi,
    unicornsFound: career.unicornsFound + harvest.unicorns,
    vetoedUnicorns: career.vetoedUnicorns + harvest.vetoedUnicorns,
    pendingOffers: null,
    pendingFund: null,
    pendingFirmName: null,
    nextFundSizeM: null,
    ledger: [
      ...career.ledger,
      {
        fundIndex: career.fundIndex,
        firmName: run.firmName,
        thesisId: run.thesis.id,
        tier: career.tier,
        fundSizeM: run.fundSizeM,
        returnedM: harvest.returnedM,
        dpi,
      },
    ],
  };

  // Ladder movement (always a new firm; promotion = poaching).
  if (career.tier === 'associate' && dpi >= CAREER.associatePromotionDpi) {
    next.tier = 'partner';
  } else if (career.tier === 'partner' && dpi >= CAREER.partnerPromotionDpi) {
    next.tier = 'gp';
  }

  if (career.tier === 'partner' && next.tier === 'gp') {
    // GP promotion: three LP offer packages; the player picks via acceptLpOffer.
    const target = nextFundSizeM(FUND_SIZING.gpBaseM, dpi, run.lpTrust);
    next.pendingOffers = generateLpOffers(rng, theses, target);
  } else {
    const baseM =
      next.tier === 'gp'
        ? Math.max(FUND_SIZING.gpBaseM, run.fundSizeM)
        : FUND_SIZING[`${next.tier}BaseM`];
    next.nextFundSizeM = nextFundSizeM(baseM, dpi, run.lpTrust);
  }

  // Enlightenment: 3x+ on a CAREER.enlightenmentMinFundM+ fund at maxed reputation.
  if (
    dpi >= CAREER.enlightenmentDpi &&
    run.fundSizeM >= CAREER.enlightenmentMinFundM &&
    run.reputation >= CAREER.enlightenmentMinRep
  ) {
    next.enlightened = true;
    next.endlessUnlocked = true;
  }

  return next;
}

/** GP: accept one of the three pending LP offer packages. */
export function acceptLpOffer(career: CareerState, offerIndex: number): CareerState {
  const offers = career.pendingOffers;
  if (!offers || !offers[offerIndex]) {
    throw new Error(`acceptLpOffer: no pending offer at index ${offerIndex}`);
  }
  const offer = offers[offerIndex] as LpOffer;
  return {
    ...career,
    pendingOffers: null,
    pendingFund: {
      sizeM: offer.fundSizeM,
      thesisId: offer.thesisId,
      quirkIndex: offer.quirkIndex,
    },
    nextFundSizeM: offer.fundSizeM,
  };
}

/** Max length of the profile name (UI input + sanitizer agree on it). */
export const PLAYER_NAME_MAX = 32;

/** Set (or clear, with blank) the profile name. Trims and caps the length. */
export function withPlayerName(career: CareerState, name: string): CareerState {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, PLAYER_NAME_MAX);
  const next: CareerState = { ...career };
  if (clean) next.playerName = clean;
  else delete next.playerName;
  return next;
}
