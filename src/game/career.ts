/**
 * Career layer: the ladder between funds. Pure functions over the plain
 * serializable CareerState. Promotion usually means poaching (a new firm);
 * meeting every LP request also earns the option to stay (stayOption).
 */

import type { Thesis } from '../content/types.ts';
import type { RNG } from './rng.ts';
import type { CareerState, GameState, LpOffer } from './types.ts';
import { trustSizeMultiplier } from './meters.ts';
import {
  CAREER,
  FIRST_FUND_AT_TIER_MEETINGS,
  FUND_SIZING,
  MEETINGS_BY_TIER,
  METERS,
  STAY,
} from './tuning.ts';
import { clamp, roundM } from './util.ts';

/** Fund II+ meetings: by tier, shorter on your first fund at a new tier. */
export function meetingsForCareer(career: CareerState): number {
  const firstAtTier = !career.ledger.some((entry) => entry.tier === career.tier);
  const first = (FIRST_FUND_AT_TIER_MEETINGS as Partial<Record<CareerState['tier'], number>>)[
    career.tier
  ];
  return firstAtTier && first !== undefined ? first : MEETINGS_BY_TIER[career.tier];
}

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
        tier: run.offerProfile === 'megaFund' ? run.tier : career.tier,
        fundSizeM: run.fundSizeM,
        returnedM: harvest.returnedM,
        dpi,
        ...(harvest.returnedM < 0 ? { careerEnded: true as const } : {}),
      },
    ],
  };

  // Ladder movement (always a new firm; promotion = poaching).
  // The ladder moves from the rung this fund was actually run at (a mega fund
  // drops you one; see OFFER_PROFILES.megaFund).
  const ranAt = run.offerProfile === 'megaFund' ? run.tier : career.tier;
  next.tier = ranAt;
  if (ranAt === 'associate' && dpi >= CAREER.associatePromotionDpi) {
    next.tier = 'partner';
  } else if (ranAt === 'partner' && dpi >= CAREER.partnerPromotionDpi) {
    next.tier = 'gp';
  }

  if (ranAt === 'partner' && next.tier === 'gp') {
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

/**
 * A fund that returned less than nothing (board-seat legal fees ate past every
 * exit) ends the career: no stay, no offers, a resignation letter.
 */
export function careerEnded(run: GameState): boolean {
  return (run.harvest?.returnedM ?? 0) < 0;
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

/** What staying at the firm you just ran would look like (rehire screen). */
export interface StayOption {
  /** False when any LP request was broken (and the DPI didn't buy
   *  forgiveness): the LPs want a word, you go. */
  allowed: boolean;
  /** Allowed only because the DPI cleared STAY.forgiveDpi despite missed
   *  LP requests. */
  forgiven: boolean;
  /** The firm folded (DPI at or below STAY.firmFoldDpi): there's nothing to
   *  stay at. Wins over everything else. */
  folded: boolean;
  firmName: string;
  thesisId: string;
  tier: CareerState['tier'];
  fundSizeM: number;
  lpTrust: number;
}

/**
 * The in-house offer after a harvested fund. `next` is closeCareerFund's
 * result (it already holds the promotion, if any, and the outside sizing).
 * Below 1x: same rung, and the fund is NOT shrunk for the DPI: it keeps the
 * money per meeting, so it grows with the calendar (Fund I ~$9M over 15
 * meetings → ~$15M over the repeat Associate's 25). 1x+: the
 * in-house promotion, a fund STAY.winSizeMult over the outside base, and a
 * little LP trust. Only open if every LP request was met.
 */
export function stayOption(next: CareerState, run: GameState): StayOption {
  const harvest = run.harvest;
  const dpi = harvest?.dpi ?? 0;
  const won = dpi >= CAREER.associatePromotionDpi;
  const allMet = (run.lpRequests ?? []).every((r) => r.status === 'met');
  const folded = dpi <= STAY.firmFoldDpi + 1e-9;
  const forgiven = !folded && !allMet && dpi >= STAY.forgiveDpi;
  const allowed = !folded && (allMet || forgiven);
  const outsideBaseM = next.pendingOffers
    ? Math.max(...next.pendingOffers.map((o) => o.fundSizeM))
    : (next.nextFundSizeM ?? run.fundSizeM);
  // Same capital per meeting as the fund just run, over the next calendar.
  const perMeetingM = run.fundSizeM / Math.max(1, run.meetingsTotal);
  const sameRungM = perMeetingM * meetingsForCareer({ ...next, tier: run.tier });
  return {
    allowed,
    forgiven,
    folded,
    firmName: run.firmName,
    thesisId: run.thesis.id,
    tier: won ? next.tier : run.tier,
    fundSizeM: won ? roundM(outsideBaseM * STAY.winSizeMult) : roundM(sameRungM),
    lpTrust: clamp(next.lpTrust + (won ? STAY.winTrustDelta : 0), METERS.min, METERS.max),
  };
}

/** Take the in-house offer: same firm and thesis, the stay terms fixed. */
export function acceptStay(next: CareerState, stay: StayOption): CareerState {
  if (!stay.allowed) throw new Error('acceptStay: LP requests were not all met');
  return {
    ...next,
    tier: stay.tier,
    lpTrust: stay.lpTrust,
    pendingOffers: null,
    // A fixed fund: createRun takes size + thesis from here, and no offer
    // profiles or rerolls apply (see offerProfileFor / firmOptions).
    pendingFund: { sizeM: stay.fundSizeM, thesisId: stay.thesisId, quirkIndex: 0 },
    pendingFirmName: stay.firmName,
    nextFundSizeM: stay.fundSizeM,
  };
}

