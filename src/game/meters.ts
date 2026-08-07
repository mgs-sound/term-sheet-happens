/** Meter math: reputation and LP trust, both clamped to METERS 0..100. */

import { METERS, REPUTATION, TRUST } from './tuning.ts';
import { clamp } from './util.ts';

export function clampMeter(value: number): number {
  return clamp(value, METERS.min, METERS.max);
}

/** Reputation stage index 0..4 (labels live in content lines.json). */
export function reputationStage(reputation: number): number {
  const thresholds = REPUTATION.stageThresholds;
  let stage = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (reputation >= (thresholds[i] as number)) stage = i;
  }
  return stage;
}

/** Next-fund size multiplier from LP trust at fund close. */
export function trustSizeMultiplier(lpTrust: number): number {
  const raw = TRUST.sizeMultBase + (clampMeter(lpTrust) / METERS.max) * TRUST.sizeMultSlope;
  return clamp(raw, TRUST.sizeMultMin, TRUST.sizeMultMax);
}
