/**
 * Exit simulation: outcome bucket distribution keyed to hidden quality, and
 * payout multiples per bucket. Buckets match content's ExitBucket keys.
 */

import type { ExitBucket } from '../content/types.ts';
import type { RNG } from './rng.ts';
import { EXITS } from './tuning.ts';
import { clamp01 } from './util.ts';

export const EXIT_ORDER: ExitBucket[] = ['zero', 'acquihire', 'base', 'win', 'unicorn'];

/**
 * Normalized bucket probabilities for a given hidden quality. `unicornScale`
 * scales the unicorn weight before normalizing (Fund I keeps it rare).
 */
export function outcomeWeights(quality: number, unicornScale = 1): Record<ExitBucket, number> {
  const q = clamp01(quality);
  const w = EXITS.weights;
  const raw: Record<ExitBucket, number> = {
    zero: Math.max(0, w.zero.base + w.zero.slope * q),
    acquihire: Math.max(0, w.acquihire.base + w.acquihire.slope * q),
    base: Math.max(0, w.base.base + w.base.slope * q),
    win: Math.max(0, w.win.base + w.win.slope * q),
    unicorn: Math.max(0, w.unicorn.base + w.unicorn.quad * q * q) * unicornScale,
  };
  const total = EXIT_ORDER.reduce((sum, b) => sum + raw[b], 0);
  for (const b of EXIT_ORDER) raw[b] /= total;
  return raw;
}

export function rollExitBucket(rng: RNG, quality: number, unicornScale = 1): ExitBucket {
  const weights = outcomeWeights(quality, unicornScale);
  let roll = rng.next();
  for (const bucket of EXIT_ORDER) {
    roll -= weights[bucket];
    if (roll < 0) return bucket;
  }
  return 'unicorn';
}

/** Payout multiple on total invested capital (before the entry bonus). */
export function rollBucketMultiple(rng: RNG, bucket: ExitBucket): number {
  const band = EXITS.multiples[bucket];
  if (band.min === band.max) return band.min;
  return rng.float(band.min, band.max);
}
