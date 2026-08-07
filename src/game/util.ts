/** Small pure math helpers shared across game systems. No React, no I/O. */

import type { RNG } from './rng.ts';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Round money to one decimal (engine keeps $M with 0.1M precision). */
export function roundM(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Pick an index from a relative-weight array (weights need not sum to 1). */
export function weightedIndex(rng: RNG, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i] as number;
    if (roll < 0) return i;
  }
  return weights.length - 1;
}
