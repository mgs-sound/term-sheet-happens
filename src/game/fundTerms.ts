import { createRng } from './rng.ts';
import { FUND_I_TERMS } from './tuning.ts';
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
