/**
 * LeaderboardService — the LP Register behind an interface, like every other
 * platform touchpoint. This is the game's ONLY network surface; it must
 * never block play. Capacitor or a future authed backend swaps the
 * implementation, nothing else.
 */

import type { ScoreSubmission } from '../game/types';

export type SubmitOutcome = 'submitted' | 'rejected' | 'unreachable';

export interface RegisterRow {
  rank: number;
  name: string;
  totalReturnedM: number;
  bestFundDpi: number;
  isYou: boolean;
}

export interface RegisterView {
  top: RegisterRow[];
  /** Present when the queried career is on the board. */
  me: { rank: number; neighbors: RegisterRow[] } | null;
}

export interface LeaderboardService {
  submit(submission: ScoreSubmission): Promise<SubmitOutcome>;
  /** null = unreachable (offline, unprovisioned, or erroring). */
  fetchBoard(careerId: string | null): Promise<RegisterView | null>;
}

const ENDPOINT = '/api/leaderboard';
const TIMEOUT_MS = 6000;

export class WebLeaderboardService implements LeaderboardService {
  async submit(submission: ScoreSubmission): Promise<SubmitOutcome> {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return 'submitted';
      // 4xx = the server said no (bad name, implausible numbers, rate limit):
      // retrying the same payload won't help, so don't queue it.
      return res.status >= 400 && res.status < 500 ? 'rejected' : 'unreachable';
    } catch {
      return 'unreachable';
    }
  }

  async fetchBoard(careerId: string | null): Promise<RegisterView | null> {
    try {
      const url = careerId ? `${ENDPOINT}?careerId=${encodeURIComponent(careerId)}` : ENDPOINT;
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return null;
      const body = (await res.json()) as RegisterView;
      if (!Array.isArray(body.top)) return null;
      return { top: body.top, me: body.me ?? null };
    } catch {
      return null;
    }
  }
}
