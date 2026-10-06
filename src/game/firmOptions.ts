import { createRun } from './engine.ts';
import { difficultyBand, eligibleOfferProfiles } from './fundTerms.ts';
import { OFFER_PROFILES_ORDER } from './types.ts';
import type { CareerState, EngineContent, GameState } from './types.ts';

/** How many firms the engagement letter lets you flip between (default). */
export const FIRM_OPTION_COUNT = 3;

/** Offers for this career: one per eligible profile in Fund II+ (3, or 4
 *  with the mega fund), else FIRM_OPTION_COUNT. */
export function firmOptionCount(career: CareerState): number {
  return eligibleOfferProfiles(career).length || FIRM_OPTION_COUNT;
}
/** Stride between candidate seeds (any odd prime spreads them well). */
const SEED_STRIDE = 7919;
/** Give up searching for a perfect set after this many candidates. */
const MAX_CANDIDATES = 600;

function nameParts(
  firmName: string,
  content: EngineContent,
): { prefix: string; suffix: string } {
  const prefix = content.firmNames.prefixes.find((p) => firmName.startsWith(p)) ?? firmName;
  const suffix = content.firmNames.suffixes.find((s) => firmName.endsWith(s)) ?? firmName;
  return { prefix, suffix };
}

/**
 * The fixed set of firms "Reroll the firm" cycles through — instead of an
 * endless slot machine (choice paralysis). Returns run seeds, deterministic
 * from `baseSeed`:
 *  - Fund I: exactly one per difficulty band, ordered Soft → Standard → Brutal.
 *  - Every option has a different thesis and shares NO name part (prefix or
 *    suffix) with the others, so the three letters read as distinct firms.
 *    (Skipped where the career pins them: a GP-chosen name / an LP thesis.)
 * `include` forces an existing seed into the set (e.g. a reloaded run).
 */
export function pickFirmOptions(
  career: CareerState,
  content: EngineContent,
  baseSeed: number,
  include?: number,
): number[] {
  const isFundI = career.fundIndex === 1;
  // Fund II+ (non-GP-package): one offer per profile (big checks / deal flow /
  // LP darling), like Fund I's one per difficulty band.
  const byProfile = eligibleOfferProfiles(career).length > 0;
  const target = firmOptionCount(career);
  const checkNames = career.pendingFirmName === null;
  const checkThesis = !career.pendingFund;

  const chosen: { seed: number; run: GameState }[] = [];
  const fits = (run: GameState): boolean => {
    if (isFundI) {
      const band = difficultyBand(run.fundIDifficulty ?? 0);
      if (chosen.some((c) => difficultyBand(c.run.fundIDifficulty ?? 0) === band)) return false;
    }
    if (byProfile && chosen.some((c) => c.run.offerProfile === run.offerProfile)) return false;
    if (checkThesis && chosen.some((c) => c.run.thesis.id === run.thesis.id)) return false;
    if (checkNames) {
      const a = nameParts(run.firmName, content);
      for (const c of chosen) {
        const b = nameParts(c.run.firmName, content);
        if (a.prefix === b.prefix || a.suffix === b.suffix) return false;
      }
    }
    return true;
  };

  if (include !== undefined) chosen.push({ seed: include, run: createRun(career, include, content) });

  for (let k = 0; k < MAX_CANDIDATES && chosen.length < target; k++) {
    const seed = (baseSeed + k * SEED_STRIDE) >>> 0;
    if (chosen.some((c) => c.seed === seed)) continue;
    const run = createRun(career, seed, content);
    if (fits(run)) chosen.push({ seed, run });
  }
  // Content too shallow for a perfect set: pad with anything new.
  for (let k = MAX_CANDIDATES; chosen.length < target; k++) {
    const seed = (baseSeed + k * SEED_STRIDE) >>> 0;
    if (!chosen.some((c) => c.seed === seed)) {
      chosen.push({ seed, run: createRun(career, seed, content) });
    }
  }

  if (byProfile) {
    const rank = (r: GameState): number =>
      r.offerProfile ? OFFER_PROFILES_ORDER.indexOf(r.offerProfile) : 0;
    chosen.sort((a, b) => rank(a.run) - rank(b.run));
  }
  if (isFundI) {
    chosen.sort(
      (a, b) =>
        difficultyBand(a.run.fundIDifficulty ?? 0) - difficultyBand(b.run.fundIDifficulty ?? 0),
    );
  }
  return chosen.map((c) => c.seed);
}
