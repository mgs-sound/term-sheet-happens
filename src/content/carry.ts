/**
 * Carry-equivalence selection: the highest rung of the price ladder the
 * carry clears (rotating among lines that share the rung), or the failure
 * pool when the fund made nothing. Pure; `key` drives rotation so repeat
 * funds vary deterministically.
 */

import type { CarryEquivalences } from './types';

export function pickCarryLine(eq: CarryEquivalences, carryM: number, key: number): string {
  const k = Math.abs(Math.trunc(key));
  if (carryM <= 0) {
    return eq.failure[k % eq.failure.length] as string;
  }
  // Validator guarantees a thresholdM of 0, so `eligible` is never empty.
  const eligible = eq.ladder.filter((e) => e.thresholdM <= carryM);
  const top = Math.max(...eligible.map((e) => e.thresholdM));
  const candidates = eligible.filter((e) => e.thresholdM === top);
  return (candidates[k % candidates.length] as { line: string }).line;
}
