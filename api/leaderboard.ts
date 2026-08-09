/**
 * The LP Register — the game's single backend endpoint (see LEADERBOARD.md).
 * Vercel serverless function adapting src/server/leaderboardCore to Upstash
 * Redis (sorted set = the board). Env: UPSTASH_REDIS_REST_URL,
 * UPSTASH_REDIS_REST_TOKEN, LEADERBOARD_ADMIN_TOKEN (for DELETE).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import {
  handleDelete,
  handleGet,
  handlePost,
  type BoardStore,
  type CoreOptions,
} from '../src/server/leaderboardCore';
import blocklistJson from '../src/content/name-blocklist.json';

const BOARD = 'lb:global';
const META = (member: string): string => `lb:career:${member}`;
const RATE = (key: string): string => `lb:${key}`;

class UpstashBoardStore implements BoardStore {
  constructor(private redis: Redis) {}

  async addScore(member: string, score: number): Promise<void> {
    await this.redis.zadd(BOARD, { score, member });
  }

  async rangeWithScores(start: number, stop: number): Promise<Array<{ member: string; score: number }>> {
    const flat = await this.redis.zrange<Array<string | number>>(BOARD, start, stop, {
      rev: true,
      withScores: true,
    });
    const out: Array<{ member: string; score: number }> = [];
    for (let i = 0; i < flat.length; i += 2) {
      out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
    }
    return out;
  }

  async rankOf(member: string): Promise<number | null> {
    const rank = await this.redis.zrevrank(BOARD, member);
    return rank === null || rank === undefined ? null : rank;
  }

  async getMeta(member: string): Promise<Record<string, string> | null> {
    const meta = await this.redis.hgetall<Record<string, string>>(META(member));
    return meta && Object.keys(meta).length > 0 ? meta : null;
  }

  async setMeta(member: string, meta: Record<string, string>): Promise<void> {
    await this.redis.hset(META(member), meta);
    await this.redis.sadd('lb:careers', member);
  }

  async bumpRate(key: string, windowSec: number): Promise<number> {
    const fullKey = RATE(key);
    const count = await this.redis.incr(fullKey);
    if (count === 1) await this.redis.expire(fullKey, windowSec);
    return count;
  }

  async clearAll(): Promise<void> {
    const members = await this.redis.smembers('lb:careers');
    const keys = [BOARD, 'lb:careers', ...members.map((m) => META(String(m)))];
    if (keys.length > 0) await this.redis.del(...keys);
  }
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return (first ?? req.socket.remoteAddress ?? 'unknown').trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    res.status(503).json({ error: 'The register is not provisioned yet.' });
    return;
  }

  const opts: CoreOptions = {
    store: new UpstashBoardStore(new Redis({ url, token })),
    blocklist: blocklistJson.blocklist,
    adminToken: process.env.LEADERBOARD_ADMIN_TOKEN,
  };

  try {
    if (req.method === 'POST') {
      // req.body is undefined/string for non-JSON garbage; core rejects it.
      const { status, body } = await handlePost(opts, req.body, clientIp(req));
      res.status(status).json(body);
    } else if (req.method === 'GET') {
      const careerId = typeof req.query.careerId === 'string' ? req.query.careerId : null;
      const { status, body } = await handleGet(opts, careerId);
      res.status(status).json(body);
    } else if (req.method === 'DELETE') {
      const headerToken = req.headers['x-admin-token'];
      const { status, body } = await handleDelete(
        opts,
        typeof headerToken === 'string' ? headerToken : null,
      );
      res.status(status).json(body);
    } else {
      res.status(405).json({ error: 'GET, POST, or DELETE.' });
    }
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: 'The register has stepped away.' });
  }
}
