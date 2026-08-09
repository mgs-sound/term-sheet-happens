/** Carry math: the fund's profit share. One formula, used everywhere. */

import { CARRY } from './tuning.ts';
import { roundM } from './util.ts';

/** Per-fund carry: max(0, returned - fundSize) * rate, in $M. */
export function fundCarryM(returnedM: number, fundSizeM: number): number {
  return roundM(Math.max(0, returnedM - fundSizeM) * CARRY.rate);
}
