/**
 * Rehire screen maths: what the outside market looks like (a summary of the
 * offers the next engagement letters will show) and how each number compares
 * with the fund you just ran (the RPG arrows). Pure; the UI only renders.
 */

import { eligibleOfferProfiles, tierBelow } from './fundTerms.ts';
import { OFFER_PROFILES } from './tuning.ts';
import type { CareerState, GameState, Tier } from './types.ts';

export const TIER_RANK: Record<Tier, number> = { associate: 0, partner: 1, gp: 2 };

export interface OutsideSummary {
  /** Lowest .. highest rung on offer. */
  tierLow: Tier;
  tierHigh: Tier;
  fundLowM: number;
  fundHighM: number;
  trustLow: number;
  trustHigh: number;
  /** GP promotion: LP packages instead of firm offers. */
  lpOffers: number | null;
}

/** The new-firm market for `next` (closeCareerFund's result). */
export function outsideSummary(next: CareerState): OutsideSummary {
  if (next.pendingOffers && next.pendingOffers.length > 0) {
    const sizes = next.pendingOffers.map((o) => o.fundSizeM);
    return {
      tierLow: next.tier,
      tierHigh: next.tier,
      fundLowM: Math.min(...sizes),
      fundHighM: Math.max(...sizes),
      trustLow: next.lpTrust,
      trustHigh: next.lpTrust,
      lpOffers: sizes.length,
    };
  }
  const baseM = next.nextFundSizeM ?? 0;
  const profiles = eligibleOfferProfiles(next);
  const bends = profiles.map((p) => OFFER_PROFILES[p]);
  const tiers = profiles.map((p) => (p === 'megaFund' ? tierBelow(next.tier) : next.tier));
  const sizes = bends.length ? bends.map((b) => baseM * b.sizeMult) : [baseM];
  const trusts = bends.length ? bends.map((b) => next.lpTrust + b.trustDelta) : [next.lpTrust];
  const ranked = (tiers.length ? tiers : [next.tier]).sort((a, b) => TIER_RANK[a] - TIER_RANK[b]);
  return {
    tierLow: ranked[0] ?? next.tier,
    tierHigh: ranked[ranked.length - 1] ?? next.tier,
    fundLowM: Math.min(...sizes),
    fundHighM: Math.max(...sizes),
    trustLow: Math.max(0, Math.min(...trusts)),
    trustHigh: Math.min(100, Math.max(...trusts)),
    lpOffers: null,
  };
}

/** RPG arrow vs. the fund just run: much better / better / same / worse. */
export type Trend = 'up2' | 'up' | 'same' | 'down';

/** Numbers: ±2% counts as the same; 1.5× or more is a big jump. */
export function trend(now: number, next: number): Trend {
  if (now <= 0) return next > 0 ? 'up' : 'same';
  const r = next / now;
  if (r >= 1.5) return 'up2';
  if (r > 1.02) return 'up';
  if (r < 0.98) return 'down';
  return 'same';
}

export function tierTrend(now: Tier, next: Tier): Trend {
  const d = TIER_RANK[next] - TIER_RANK[now];
  return d > 0 ? 'up' : d < 0 ? 'down' : 'same';
}

/** Trust is a 0..100 meter: compare points, not ratios. */
export function trustTrend(now: number, next: number): Trend {
  const d = next - now;
  return d >= 10 ? 'up2' : d > 0 ? 'up' : d < 0 ? 'down' : 'same';
}

/** The run's final trust is what the next fund starts from. */
export function runEndTrust(run: GameState): number {
  return run.lpTrust;
}
