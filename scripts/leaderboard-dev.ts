/**
 * Local LP Register — `npm run dev:api`. Serves the same core handlers as
 * the Vercel function on :3999 with an in-memory store (no Redis needed);
 * the Vite dev server proxies /api here. State resets on restart.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MemoryBoardStore,
  handleDelete,
  handleGet,
  handlePost,
  type CoreOptions,
} from '../src/server/leaderboardCore.ts';

const PORT = 3999;
const blocklistPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'content',
  'name-blocklist.json',
);
const blocklist = (JSON.parse(readFileSync(blocklistPath, 'utf8')) as { blocklist: string[] })
  .blocklist;

const opts: CoreOptions = {
  store: new MemoryBoardStore(),
  blocklist,
  adminToken: process.env.LEADERBOARD_ADMIN_TOKEN ?? 'dev-admin',
};

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      if (!url.pathname.startsWith('/api/leaderboard')) {
        res.writeHead(404).end();
        return;
      }
      let result;
      if (req.method === 'POST') {
        let body: unknown;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          body = undefined;
        }
        result = await handlePost(opts, body, req.socket.remoteAddress ?? 'local');
      } else if (req.method === 'GET') {
        result = await handleGet(opts, url.searchParams.get('careerId'));
      } else if (req.method === 'DELETE') {
        const token = req.headers['x-admin-token'];
        result = await handleDelete(opts, typeof token === 'string' ? token : null);
      } else {
        result = { status: 405, body: { error: 'GET, POST, or DELETE.' } };
      }
      res.writeHead(result.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result.body));
    })();
  });
});

server.listen(PORT, () => {
  console.log(`LP Register (dev, in-memory) on http://localhost:${PORT}/api/leaderboard`);
});
