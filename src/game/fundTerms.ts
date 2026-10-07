import { createRng } from './rng.ts';
import { BIG_FUNDS, FUND_I_TERMS, OFFER_PROFILES } from './tuning.ts';
import { OFFER_PROFILES_ORDER, type CareerState, type OfferProfile } from './types.ts';
import { roundM } from './util.ts';

export type DifficultyBand = 0 | 1 | 2; // soft / standard / brutal (labels in content)

export interface FundITerms {
  /** The dial, 0 (softest) .. 1 (most brutal). */
  difficulty: number;
  band: DifficultyBand;
  sizeM: number;
  meetings: number;
  lpTrustOffset: number;
}

const lerp = (range: { easy: number; hard: number }, t: number): number =>
  range.easy + (range.hard - range.easy) * t;

export function difficultyBand(t: number): DifficultyBand {
  const [a, b] = FUND_I_TERMS.bandCutoffs;
  return t < a ? 0 : t < b ? 1 : 2;
}

/**
 * Fund I terms for a run seed. Uses its own salted RNG so it never consumes
 * from the run's main stream. Every value stays inside the FUND_I_TERMS
 * easy..hard clamp by construction (t is in [0, 1)).
 */
export function rollFundITerms(seed: number): FundITerms {
  const t = createRng((seed ^ FUND_I_TERMS.rngSalt) >>> 0).next();
  return {
    difficulty: t,
    band: difficultyBand(t),
    sizeM: roundM(lerp(FUND_I_TERMS.sizeM, t)),
    meetings: Math.round(lerp(FUND_I_TERMS.meetings, t)),
    lpTrustOffset: Math.round(lerp(FUND_I_TERMS.lpTrustOffset, t)),
  };
}

/**
 * Profiles a Fund II+ offer can roll — always three. The mega fund (only
 * after a 1x+ fund, for someone with a rung to drop) takes Big checks' slot:
 * it is the "much bigger fund" option.
 */
export function eligibleOfferProfiles(career: CareerState): OfferProfile[] {
  if (career.fundIndex === 1 || career.pendingFund) return [];
  const mega =
    career.tier !== 'associate' &&
    (career.lastFundDpi ?? 0) >= OFFER_PROFILES.megaMinLastDpi;
  return OFFER_PROFILES_ORDER.filter((p) => (mega ? p !== 'bigChecks' : p !== 'megaFund'));
}

/**
 * Fund II+ offer flavor for a run seed (own salted RNG, like the Fund I
 * dial). Null where it doesn't apply: Fund I has its difficulty dial, and a
 * fixed fund (GP's LP package, or staying at your firm) is already set.
 */
export function offerProfileFor(career: CareerState, seed: number): OfferProfile | null {
  const pool = eligibleOfferProfiles(career);
  if (pool.length === 0) return null;
  const i = Math.floor(createRng((seed ^ OFFER_PROFILES.rngSalt) >>> 0).next() * pool.length);
  return pool[i] ?? pool[0] ?? null;
}

/**
 * The surprise-box swing on a new-firm offer (see OFFER_PROFILES.sizeSwing):
 * a fund-size multiplier and an LP trust offset. Neutral when no offer
 * profile applies (Fund I, a fixed fund).
 */
export function offerSwingFor(
  career: CareerState,
  seed: number,
): { sizeMult: number; trustDelta: number } {
  if (!offerProfileFor(career, seed)) return { sizeMult: 1, trustDelta: 0 };
  const rng = createRng((seed ^ OFFER_PROFILES.swingSalt) >>> 0);
  const { min, max } = OFFER_PROFILES.sizeSwing;
  return {
    sizeMult: min + (max - min) * rng.next(),
    trustDelta: rng.int(-OFFER_PROFILES.trustSwing, OFFER_PROFILES.trustSwing),
  };
}

/**
 * Big-fund terms (see BIG_FUNDS): how much card asks/valuations scale so the
 * fund is deployable, and the LP pressure level that comes with it.
 */
export function bigFundTerms(
  fundSizeM: number,
  meetings: number,
  tier: CareerState['tier'],
): { checkScale: number; pressure: number } {
  const perMeetingM = fundSizeM / Math.max(1, meetings);
  const checkScale = Math.max(1, perMeetingM / BIG_FUNDS.refPerMeetingM[tier]);
  const pressure = BIG_FUNDS.pressureAt.filter((at) => checkScale >= at).length;
  return { checkScale, pressure };
}

/** One rung down the ladder (mega fund), never below associate. */
export function tierBelow(tier: CareerState['tier']): CareerState['tier'] {
  return tier === 'gp' ? 'partner' : 'associate';
}
