/**
 * Simulation harness: plays full runs with a deterministic naive strategy.
 * Shared by the monte-carlo test suite and scripts/simulate.ts. Content is
 * injected — this file must not import the Vite content loader.
 */

import type { CareerState, EngineContent, GameState } from './types.ts';
import { reduce } from './engine.ts';
import { initialCareer } from './career.ts';
import { FUND_SIZING, SIM } from './tuning.ts';

/**
 * Naive policy: sign at ask whenever affordable and the card looks shiny
 * (stat sum or heat) — the tourist strategy the tutorial expects. Accepts
 * affordable follow-ons/bridges, never presses LPs, never takes board seats.
 */
export function simulateRun(
  career: CareerState,
  seed: number,
  content: EngineContent,
): GameState {
  let s = reduce(null, { type: 'START_RUN', career, seed, content });
  for (let step = 0; step < SIM.maxSteps; step++) {
    if (s.phase === 'harvested') return s;
    s = reduce(s, nextAction(s));
  }
  throw new Error(`simulateRun: no harvest after ${SIM.maxSteps} steps (seed ${seed})`);
}

function nextAction(
  s: GameState,
): Parameters<typeof reduce>[1] {
  switch (s.phase) {
    case 'meeting': {
      if (s.resolution !== null) return { type: 'ADVANCE' };
      if (s.currentCard === null) return { type: 'CLOSE_FUND' };
      const card = s.currentCard;
      const shiny =
        card.team + card.traction >= SIM.signStatSumMin || card.heat >= SIM.signHeatMin;
      if (shiny && card.askM <= s.capitalM) return { type: 'SIGN_AT_ASK' };
      return { type: 'PASS' };
    }
    case 'interrupt': {
      const event = s.interrupt;
      if (!event) throw new Error('interrupt phase without event');
      if (event.kind === 'followOn') {
        return { type: 'RESOLVE_INTERRUPT', accept: event.proRataCostM <= s.capitalM };
      }
      if (event.kind === 'bridge') {
        return { type: 'RESOLVE_INTERRUPT', accept: event.costM <= s.capitalM };
      }
      return { type: 'RESOLVE_INTERRUPT', accept: false }; // eat the capital call
    }
    case 'vetoChallenge':
      return { type: 'RESOLVE_VETO_CHALLENGE', call: 'heads' };
    case 'fundClosed':
      return { type: 'HARVEST' };
    default:
      throw new Error(`Naive strategy stuck in phase ${s.phase}`);
  }
}

/** Synthetic careers per tier for distribution scans. */
export function careerForTier(tier: 'fundI' | 'associate' | 'partner' | 'gp'): CareerState {
  const base = initialCareer();
  switch (tier) {
    case 'fundI':
      return base;
    case 'associate':
      return { ...base, fundIndex: 2, nextFundSizeM: FUND_SIZING.associateBaseM };
    case 'partner':
      return { ...base, tier: 'partner', fundIndex: 3, nextFundSizeM: FUND_SIZING.partnerBaseM };
    case 'gp':
      return { ...base, tier: 'gp', fundIndex: 4, nextFundSizeM: FUND_SIZING.gpBaseM };
  }
}

export interface DpiSummary {
  runs: number;
  mean: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  above1x: number; // fraction of runs
  above2x: number;
  above3x: number;
}

export function summarizeDpis(dpis: number[]): DpiSummary {
  const sorted = [...dpis].sort((a, b) => a - b);
  const at = (p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number;
  const mean = sorted.reduce((sum, d) => sum + d, 0) / sorted.length;
  const frac = (t: number): number => sorted.filter((d) => d >= t).length / sorted.length;
  return {
    runs: sorted.length,
    mean,
    p10: at(0.1),
    p25: at(0.25),
    median: at(0.5),
    p75: at(0.75),
    p90: at(0.9),
    above1x: frac(1),
    above2x: frac(2),
    above3x: frac(3),
  };
}

export function formatSummary(label: string, s: DpiSummary): string {
  const f = (n: number): string => n.toFixed(2);
  const pct = (n: number): string => `${Math.round(n * 100)}%`;
  return (
    `${label.padEnd(10)} runs=${s.runs}  mean=${f(s.mean)}  ` +
    `p10=${f(s.p10)} p25=${f(s.p25)} median=${f(s.median)} p75=${f(s.p75)} p90=${f(s.p90)}  ` +
    `>=1x ${pct(s.above1x)}  >=2x ${pct(s.above2x)}  >=3x ${pct(s.above3x)}`
  );
}
