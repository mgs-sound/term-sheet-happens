/** Firm generation: name from prefix+suffix pools, thesis assignment. */

import type { FirmNameParts, Thesis } from '../content/types.ts';
import type { RNG } from './rng.ts';

export function generateFirmName(rng: RNG, parts: FirmNameParts): string {
  const prefix = rng.pick(parts.prefixes);
  const suffix = rng.pick(parts.suffixes);
  return `${prefix} ${suffix}`;
}

export function pickThesis(rng: RNG, theses: readonly Thesis[]): Thesis {
  return rng.pick(theses);
}

export function findThesis(theses: readonly Thesis[], id: string): Thesis | null {
  return theses.find((t) => t.id === id) ?? null;
}
