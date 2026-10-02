/** Firm generation: name from prefix+suffix pools, thesis assignment. */

import type { FirmNameParts, Thesis } from '../content/types.ts';
import type { RNG } from './rng.ts';

export function generateFirmName(rng: RNG, parts: FirmNameParts): string {
  const prefix = rng.pick(parts.prefixes);
  const suffix = rng.pick(parts.suffixes);
  return `${prefix} ${suffix}`;
}

/**
 * Splits a generated name back into [prefix, suffix] so titles can stack it
 * like a letterhead ("DEAD CAT / & SONS"). Null for custom (GP-typed) names.
 */
export function splitFirmName(name: string, parts: FirmNameParts): [string, string] | null {
  for (const prefix of parts.prefixes) {
    if (!name.startsWith(`${prefix} `)) continue;
    const suffix = name.slice(prefix.length + 1);
    if (parts.suffixes.includes(suffix)) return [prefix, suffix];
  }
  return null;
}

export function pickThesis(rng: RNG, theses: readonly Thesis[]): Thesis {
  return rng.pick(theses);
}

export function findThesis(theses: readonly Thesis[], id: string): Thesis | null {
  return theses.find((t) => t.id === id) ?? null;
}
