import { describe, expect, it } from 'vitest';
import blocklistJson from '../content/name-blocklist.json';
import { LEADERBOARD } from '../game/tuning';
import {
  MemoryBoardStore,
  handleDelete,
  handleGet,
  handlePost,
  type CoreOptions,
} from './leaderboardCore';

function makeOpts(): CoreOptions {
  return {
    store: new MemoryBoardStore(),
    blocklist: blocklistJson.blocklist,
    adminToken: 'secret',
  };
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function submission(n: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    careerId: uuid(n),
    name: `GP NUMBER ${n}`,
    totalReturnedM: n * 10,
    bestFundDpi: 2.5,
    bestFundSizeM: 100,
    ...overrides,
  };
}

describe('LP register: POST validation', () => {
  it('accepts a clean submission and reports rank', async () => {
    const opts = makeOpts();
    const res = await handlePost(opts, submission(1), 'ip-a');
    expect(res.status).toBe(200);
    expect(res.body.rank).toBe(1);
  });

  it('rejects garbage, bad ids, and implausible numbers', async () => {
    const opts = makeOpts();
    expect((await handlePost(opts, undefined, 'ip')).status).toBe(400);
    expect((await handlePost(opts, 'not json', 'ip')).status).toBe(400);
    expect((await handlePost(opts, submission(1, { careerId: 'nope' }), 'ip')).status).toBe(400);
    expect(
      (await handlePost(opts, submission(1, { totalReturnedM: LEADERBOARD.maxTotalReturnedM + 1 }), 'ip'))
        .status,
    ).toBe(400);
    expect((await handlePost(opts, submission(1, { totalReturnedM: -5 }), 'ip')).status).toBe(400);
    expect((await handlePost(opts, submission(1, { bestFundDpi: 999 }), 'ip')).status).toBe(400);
    expect((await handlePost(opts, submission(1, { totalReturnedM: 'lots' }), 'ip')).status).toBe(400);
  });

  it('moderates names: length, blocklist, and lookalike evasion', async () => {
    const opts = makeOpts();
    expect((await handlePost(opts, submission(1, { name: 'A' }), 'ip')).status).toBe(400);
    expect((await handlePost(opts, submission(1, { name: 'X'.repeat(21) }), 'ip')).status).toBe(400);
    expect((await handlePost(opts, submission(1, { name: 'total shithead' }), 'ip')).status).toBe(400);
    expect((await handlePost(opts, submission(1, { name: 'Sh!7head Capital' }), 'ip')).status).toBe(400);
    expect((await handlePost(opts, submission(1, { name: 'F4GG 0T' }), 'ip')).status).toBe(400);
    // Whitespace collapses; a legit name survives.
    const ok = await handlePost(opts, submission(1, { name: '  DPI   DEMON  ' }), 'ip');
    expect(ok.status).toBe(200);
    const board = await handleGet(opts, null);
    expect((board.body.top as Array<{ name: string }>)[0]?.name).toBe('DPI DEMON');
  });

  it('upserts by careerId — resubmits update, never duplicate', async () => {
    const opts = makeOpts();
    await handlePost(opts, submission(1, { totalReturnedM: 100 }), 'ip-a');
    await handlePost(opts, submission(1, { totalReturnedM: 250, name: 'RENAMED FUND' }), 'ip-b');
    const res = await handleGet(opts, null);
    const top = res.body.top as Array<{ name: string; totalReturnedM: number }>;
    expect(top).toHaveLength(1);
    expect(top[0]?.totalReturnedM).toBe(250);
    expect(top[0]?.name).toBe('RENAMED FUND');
  });

  it('rate limits per IP', async () => {
    const opts = makeOpts();
    for (let i = 0; i < LEADERBOARD.submitsPerHour; i++) {
      expect((await handlePost(opts, submission(i + 1), 'same-ip')).status).toBe(200);
    }
    expect((await handlePost(opts, submission(99), 'same-ip')).status).toBe(429);
    // Other IPs unaffected.
    expect((await handlePost(opts, submission(100), 'other-ip')).status).toBe(200);
  });
});

describe('LP register: GET', () => {
  it('returns the top N, marks your row, and finds neighbors below the fold', async () => {
    const opts = makeOpts();
    for (let i = 1; i <= 60; i++) {
      // Distinct IPs so seeding does not trip the rate limit.
      await handlePost(opts, submission(i, { totalReturnedM: i * 10 }), `ip-${i}`);
    }
    // Highest scores first: careers 60..11 fill the top 50. Career 6 sits at rank 55.
    const res = await handleGet(opts, uuid(6));
    const top = res.body.top as Array<{ rank: number; totalReturnedM: number; isYou: boolean }>;
    expect(top).toHaveLength(LEADERBOARD.topN);
    expect(top[0]?.rank).toBe(1);
    expect(top[0]?.totalReturnedM).toBe(600);
    expect(top.some((r) => r.isYou)).toBe(false);

    const me = res.body.me as { rank: number; neighbors: Array<{ rank: number; isYou: boolean }> };
    expect(me.rank).toBe(55);
    expect(me.neighbors.map((n) => n.rank)).toEqual([53, 54, 55, 56, 57]);
    expect(me.neighbors.find((n) => n.rank === 55)?.isYou).toBe(true);
  });

  it('marks your row inside the top', async () => {
    const opts = makeOpts();
    await handlePost(opts, submission(1), 'a');
    await handlePost(opts, submission(2), 'b');
    const res = await handleGet(opts, uuid(2));
    const top = res.body.top as Array<{ isYou: boolean; rank: number }>;
    expect(top.find((r) => r.isYou)?.rank).toBe(1); // career 2 has the higher score
  });
});

describe('LP register: DELETE', () => {
  it('requires the admin token, then wipes', async () => {
    const opts = makeOpts();
    await handlePost(opts, submission(1), 'a');
    expect((await handleDelete(opts, null)).status).toBe(403);
    expect((await handleDelete(opts, 'wrong')).status).toBe(403);
    expect((await handleDelete({ ...opts, adminToken: undefined }, 'secret')).status).toBe(403);
    expect((await handleDelete(opts, 'secret')).status).toBe(200);
    const res = await handleGet(opts, null);
    expect(res.body.top).toEqual([]);
  });
});
