/**
 * LP requests: 1..3 side objectives per fund ("Stay on thesis", "Keep dry
 * powder", ...). Optional: meeting one pays LP trust at harvest, breaking one
 * costs nothing but the bonus. Pure TS; rolled from a salted RNG so adding
 * them never shifts the run's main stream (deck, exits).
 */

import { createRng } from './rng.ts';
import type { GameState, LpRequest, LpRequestKind, Tier } from './types.ts';
import { LP_REQUESTS } from './tuning.ts';

/**
 * Which requests a fund can roll. Fund I is the tutorial: only requests the
 * player fully controls (no luck at harvest), so the first one is always
 * doable. Its deck can't make unicorns anyway, and returning the fund there
 * is a ~1-in-3 shot. ('returnFund' stays in the catalogue for later tiers.)
 */
export function requestPool(isFundI: boolean): LpRequestKind[] {
  return isFundI
    ? ['onThesis', 'dryPowder', 'coolDeals', 'reliableTeams']
    : ['onThesis', 'dryPowder', 'unicorn', 'diversify', 'coolDeals', 'reliableTeams', 'returnFund'];
}

/** A DPI target from the tier's band, on the step grid (e.g. 0.5, 0.75, 1). */
function rollDpiTarget(rng: ReturnType<typeof createRng>, tier: Tier): number {
  const band = LP_REQUESTS.dpiTargetByTier[tier];
  const steps = Math.round((band.max - band.min) / LP_REQUESTS.dpiTargetStep);
  return band.min + rng.int(0, steps) * LP_REQUESTS.dpiTargetStep;
}

function clashes(a: LpRequestKind, b: LpRequestKind): boolean {
  return LP_REQUESTS.exclusive.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** The numbers a request is judged by: normal, or a big fund's strict ones. */
export function requestThresholds(r: Pick<LpRequest, 'strict'>): {
  dryPowderMaxDeployed: number;
  diversifyMinOffThesis: number;
  coolDealsMaxHeat: number;
  reliableTeamsMinTeam: number;
} {
  return r.strict ? LP_REQUESTS.strict : LP_REQUESTS;
}

/**
 * The fund's requests for a run seed: distinct kinds, count in min..max.
 * `pressure` (0 normal, 1..2 big fund — see BIG_FUNDS) adds requests and
 * makes them strict.
 */
export function rollLpRequests(
  seed: number,
  isFundI: boolean,
  tier: Tier = 'associate',
  pressure = 0,
): LpRequest[] {
  const rng = createRng((seed ^ LP_REQUESTS.rngSalt) >>> 0);
  const pool = requestPool(isFundI);
  const level =
    LP_REQUESTS.byPressure[Math.min(pressure, LP_REQUESTS.byPressure.length - 1)] ??
    LP_REQUESTS.byPressure[0]!;
  const count = isFundI ? LP_REQUESTS.fundICount : rng.int(level.minCount, level.maxCount);
  // Walk a shuffled pool, skipping anything that contradicts a pick, and
  // capping the luck-decided (results) requests.
  const isResult = (k: LpRequestKind): boolean => LP_REQUESTS.resultKinds.includes(k);
  const picked: LpRequestKind[] = [];
  for (const kind of rng.shuffle(pool)) {
    if (picked.length >= count) break;
    if (picked.some((p) => clashes(p, kind))) continue;
    if (isResult(kind) && picked.filter(isResult).length >= level.maxResultKinds) continue;
    picked.push(kind);
  }
  return picked.map((kind) => ({
    kind,
    status: 'open' as const,
    lineIndex: rng.int(0, 999),
    ...(kind === 'returnFund' ? { target: rollDpiTarget(rng, tier) } : {}),
    ...(pressure > 0 && !isFundI ? { strict: true } : {}),
  }));
}

/** Capital actually put to work: initial checks + follow-ons + bridges. */
export function deployedM(s: GameState): number {
  return s.portfolio.reduce((sum, c) => sum + c.investedM, 0);
}

/** Would this request be broken by the run as it stands right now? */
function brokenNow(s: GameState, r: LpRequest): boolean {
  const t = requestThresholds(r);
  switch (r.kind) {
    case 'onThesis':
      return s.portfolio.some((c) => !c.card.onThesis);
    case 'dryPowder':
      return deployedM(s) > s.fundSizeM * t.dryPowderMaxDeployed + 1e-9;
    case 'coolDeals':
      return s.portfolio.some((c) => c.card.heat > t.coolDealsMaxHeat);
    case 'reliableTeams':
      return s.portfolio.some((c) => c.card.team < t.reliableTeamsMinTeam);
    default:
      return false; // decided at harvest
  }
}

/**
 * Mid-run check, after every action: flips open requests to broken the
 * moment the run violates them. Returns the kinds that just broke.
 */
export function updateLiveLpRequests(s: GameState): LpRequestKind[] {
  const broke: LpRequestKind[] = [];
  for (const r of s.lpRequests ?? []) {
    if (r.status === 'open' && brokenNow(s, r)) {
      r.status = 'broken';
      broke.push(r.kind);
    }
  }
  return broke;
}

/**
 * Harvest: settles every request still open. Live requests survive to here
 * only if never violated, but still need at least one investment to count
 * (an empty fund didn't stay on thesis, it stayed home). Returns how many
 * were met.
 */
export function settleLpRequests(s: GameState): number {
  const harvest = s.harvest;
  let met = 0;
  for (const r of s.lpRequests ?? []) {
    if (r.status !== 'open') continue;
    let ok: boolean;
    switch (r.kind) {
      case 'onThesis':
      case 'dryPowder':
      case 'coolDeals':
      case 'reliableTeams':
        ok = s.portfolio.length > 0;
        break;
      case 'diversify':
        ok =
          s.portfolio.filter((c) => !c.card.onThesis).length >= requestThresholds(r).diversifyMinOffThesis;
        break;
      case 'unicorn':
        ok = (harvest?.unicorns ?? 0) > 0;
        break;
      case 'returnFund':
        ok = (harvest?.dpi ?? 0) >= (r.target ?? LP_REQUESTS.returnFundDpi) - 1e-9;
        break;
    }
    r.status = ok ? 'met' : 'broken';
    if (!ok && s.portfolio.length === 0 && r.kind !== 'unicorn' && r.kind !== 'returnFund') {
      r.reason = 'noDeals';
    }
    if (ok) met += 1;
  }
  return met;
}
