/**
 * LP Register core: validation, moderation, ranking, rate limiting — all
 * transport- and storage-agnostic. The Vercel function (api/leaderboard.ts)
 * adapts this to Upstash Redis; tests and the local dev server use
 * MemoryBoardStore. Pure TS, no React, runnable under plain Node
 * (hence the .ts import extensions and injected blocklist).
 */

import { LEADERBOARD } from '../game/tuning.ts';
import { createNameFilter } from '../content/nameFilter.ts';

// ---------------------------------------------------------------- storage

/** Semantic storage operations; Redis sorted set + hash underneath. */
export interface BoardStore {
  /** ZADD: upsert a member's score. */
  addScore(member: string, score: number): Promise<void>;
  /** Highest-first slice [start..stop] inclusive, like ZRANGE REV. */
  rangeWithScores(start: number, stop: number): Promise<Array<{ member: string; score: number }>>;
  /** 0-based rank from the top, or null when absent (ZREVRANK). */
  rankOf(member: string): Promise<number | null>;
  getMeta(member: string): Promise<Record<string, string> | null>;
  setMeta(member: string, meta: Record<string, string>): Promise<void>;
  /** INCR with expiry on first hit; returns the post-increment count. */
  bumpRate(key: string, windowSec: number): Promise<number>;
  /** Wipe the board and all metadata. */
  clearAll(): Promise<void>;
}

/** In-memory BoardStore for tests and the local dev API. */
export class MemoryBoardStore implements BoardStore {
  private scores = new Map<string, number>();
  private meta = new Map<string, Record<string, string>>();
  private rates = new Map<string, { count: number; resetAt: number }>();

  private sorted(): Array<{ member: string; score: number }> {
    return [...this.scores.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score || a.member.localeCompare(b.member));
  }

  async addScore(member: string, score: number): Promise<void> {
    this.scores.set(member, score);
  }

  async rangeWithScores(start: number, stop: number): Promise<Array<{ member: string; score: number }>> {
    return this.sorted().slice(start, stop + 1);
  }

  async rankOf(member: string): Promise<number | null> {
    const idx = this.sorted().findIndex((e) => e.member === member);
    return idx === -1 ? null : idx;
  }

  async getMeta(member: string): Promise<Record<string, string> | null> {
    return this.meta.get(member) ?? null;
  }

  async setMeta(member: string, meta: Record<string, string>): Promise<void> {
    this.meta.set(member, meta);
  }

  async bumpRate(key: string, windowSec: number): Promise<number> {
    const now = Date.now();
    const entry = this.rates.get(key);
    if (!entry || entry.resetAt <= now) {
      this.rates.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async clearAll(): Promise<void> {
    this.scores.clear();
    this.meta.clear();
  }
}

// ---------------------------------------------------------------- handlers

export interface CoreResult {
  status: number;
  body: Record<string, unknown>;
}

export interface CoreOptions {
  store: BoardStore;
  blocklist: readonly string[];
  adminToken?: string | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CAREER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Row {
  rank: number;
  name: string;
  totalReturnedM: number;
  bestFundDpi: number;
  isYou: boolean;
}

async function toRows(
  store: BoardStore,
  entries: Array<{ member: string; score: number }>,
  startRank: number,
  youId: string | null,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const [i, entry] of entries.entries()) {
    const meta = await store.getMeta(entry.member);
    rows.push({
      rank: startRank + i + 1,
      name: meta?.name ?? 'A quiet fund',
      totalReturnedM: entry.score,
      bestFundDpi: Number(meta?.bestFundDpi ?? 0),
      isYou: youId !== null && entry.member === youId,
    });
  }
  return rows;
}

export async function handlePost(opts: CoreOptions, body: unknown, ip: string): Promise<CoreResult> {
  const { store, blocklist } = opts;

  const rate = await store.bumpRate(`rl:${ip}`, LEADERBOARD.rateWindowSec);
  if (rate > LEADERBOARD.submitsPerHour) {
    return { status: 429, body: { error: 'Rate limited. The register admires the enthusiasm.' } };
  }

  if (!isRecord(body)) return { status: 400, body: { error: 'Malformed submission.' } };
  const { careerId, name, totalReturnedM, bestFundDpi, bestFundSizeM } = body;

  if (typeof careerId !== 'string' || !CAREER_ID_RE.test(careerId)) {
    return { status: 400, body: { error: 'Invalid careerId.' } };
  }
  const filter = createNameFilter(blocklist);
  const cleanName =
    typeof name === 'string'
      ? filter.clean(name, LEADERBOARD.nameMinLen, LEADERBOARD.nameMaxLen)
      : null;
  if (!cleanName) {
    return { status: 400, body: { error: 'That name will not appear in the register.' } };
  }
  const numbersOk =
    typeof totalReturnedM === 'number' &&
    Number.isFinite(totalReturnedM) &&
    totalReturnedM >= 0 &&
    totalReturnedM <= LEADERBOARD.maxTotalReturnedM &&
    typeof bestFundDpi === 'number' &&
    Number.isFinite(bestFundDpi) &&
    bestFundDpi >= 0 &&
    bestFundDpi <= LEADERBOARD.maxBestDpi &&
    typeof bestFundSizeM === 'number' &&
    Number.isFinite(bestFundSizeM) &&
    bestFundSizeM >= 0 &&
    bestFundSizeM <= LEADERBOARD.maxBestFundSizeM;
  if (!numbersOk) {
    return { status: 400, body: { error: 'Those numbers strain belief.' } };
  }

  await store.addScore(careerId, totalReturnedM);
  await store.setMeta(careerId, {
    name: cleanName,
    bestFundDpi: String(bestFundDpi),
    bestFundSizeM: String(bestFundSizeM),
    updatedAt: new Date().toISOString(),
  });
  const rank = await store.rankOf(careerId);
  return { status: 200, body: { ok: true, rank: rank === null ? null : rank + 1 } };
}

export async function handleGet(opts: CoreOptions, careerId: string | null): Promise<CoreResult> {
  const { store } = opts;
  const youId = careerId && CAREER_ID_RE.test(careerId) ? careerId : null;

  const top = await toRows(store, await store.rangeWithScores(0, LEADERBOARD.topN - 1), 0, youId);

  let me: { rank: number; neighbors: Row[] } | null = null;
  if (youId) {
    const rank = await store.rankOf(youId);
    if (rank !== null) {
      const start = Math.max(0, rank - LEADERBOARD.neighborSpan);
      const stop = rank + LEADERBOARD.neighborSpan;
      me = {
        rank: rank + 1,
        neighbors: await toRows(store, await store.rangeWithScores(start, stop), start, youId),
      };
    }
  }
  return { status: 200, body: { top, me } };
}

export async function handleDelete(opts: CoreOptions, token: string | null): Promise<CoreResult> {
  if (!opts.adminToken || token !== opts.adminToken) {
    return { status: 403, body: { error: 'The register declines.' } };
  }
  await opts.store.clearAll();
  return { status: 200, body: { ok: true, wiped: true } };
}
