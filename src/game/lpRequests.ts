/**
 * LP requests: 1..3 side objectives per fund ("Stay on thesis", "Keep dry
 * powder", ...). Optional: meeting one pays LP trust at harvest, breaking one
 * costs nothing but the bonus. Pure TS; rolled from a salted RNG so adding
 * them never shifts the run's main stream (deck, exits).
 */

import { createRng } from './rng.ts';
import type { GameState, LpRequest, LpRequestKind } from './types.ts';
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
    : ['onThesis', 'dryPowder', 'unicorn', 'diversify', 'coolDeals', 'reliableTeams'];
}

function clashes(a: LpRequestKind, b: LpRequestKind): boolean {
  return LP_REQUESTS.exclusive.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** The fund's requests for a run seed: distinct kinds, count in min..max. */
export function rollLpRequests(seed: number, isFundI: boolean): LpRequest[] {
  const rng = createRng((seed ^ LP_REQUESTS.rngSalt) >>> 0);
  const pool = requestPool(isFundI);
  const count = isFundI
    ? LP_REQUESTS.fundICount
    : rng.int(LP_REQUESTS.minCount, LP_REQUESTS.maxCount);
  // Walk a shuffled pool, skipping anything that contradicts a pick.
  const picked: LpRequestKind[] = [];
  for (const kind of rng.shuffle(pool)) {
    if (picked.length >= count) break;
    if (picked.some((p) => clashes(p, kind))) continue;
    picked.push(kind);
  }
  return picked.map((kind) => ({ kind, status: 'open' as const, lineIndex: rng.int(0, 999) }));
}

/** Capital actually put to work: initial checks + follow-ons + bridges. */
export function deployedM(s: GameState): number {
  return s.portfolio.reduce((sum, c) => sum + c.investedM, 0);
}

/** Would this request be broken by the run as it stands right now? */
function brokenNow(s: GameState, kind: LpRequestKind): boolean {
  switch (kind) {
    case 'onThesis':
      return s.portfolio.some((c) => !c.card.onThesis);
    case 'dryPowder':
      return deployedM(s) > s.fundSizeM * LP_REQUESTS.dryPowderMaxDeployed + 1e-9;
    case 'coolDeals':
      return s.portfolio.some((c) => c.card.heat > LP_REQUESTS.coolDealsMaxHeat);
    case 'reliableTeams':
      return s.portfolio.some((c) => c.card.team < LP_REQUESTS.reliableTeamsMinTeam);
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
    if (r.status === 'open' && brokenNow(s, r.kind)) {
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
          s.portfolio.filter((c) => !c.card.onThesis).length >= LP_REQUESTS.diversifyMinOffThesis;
        break;
      case 'unicorn':
        ok = (harvest?.unicorns ?? 0) > 0;
        break;
      case 'returnFund':
        ok = (harvest?.dpi ?? 0) >= LP_REQUESTS.returnFundDpi;
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
