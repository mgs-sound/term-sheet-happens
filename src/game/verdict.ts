/** Scorecard verdict band from DPI. Copy per bucket lives in content. */

import type { VerdictBucket } from '../content/types.ts';
import { VERDICT_DPI } from './tuning.ts';

export function verdictBucket(dpi: number): VerdictBucket {
  if (dpi < VERDICT_DPI.wipeoutMax) return 'wipeout';
  if (dpi < VERDICT_DPI.underwaterMax) return 'underwater';
  if (dpi < VERDICT_DPI.respectableMax) return 'respectable';
  if (dpi < VERDICT_DPI.heaterMax) return 'heater';
  return 'legend';
}
