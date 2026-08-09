import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import qrcode from 'qrcode-terminal';

/**
 * Dev-only middleware for the content review tool (?review=1): GET/POST
 * /__review round-trips decisions to src/content/review-state.json.
 * `configureServer` never runs in builds, so there is no production surface.
 */
function reviewPlugin(): Plugin {
  const statePath = resolve(process.cwd(), 'src/content/review-state.json');
  const readState = (): Record<string, unknown> => {
    if (!existsSync(statePath)) return { _source: 'Review decisions from ?review=1. Applied by npm run apply-review.', decisions: {} };
    return JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, unknown>;
  };
  return {
    name: 'tsh-review',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__review', (req, res) => {
        const send = (status: number, body: unknown): void => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET') {
          send(200, readState());
          return;
        }
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            try {
              const { pitchId, decision, name, idea } = JSON.parse(
                Buffer.concat(chunks).toString('utf8'),
              ) as { pitchId: string; decision: string; name?: string; idea?: string };
              if (!pitchId || !['keep', 'kill', 'edit', 'flag'].includes(decision)) {
                send(400, { error: 'bad decision' });
                return;
              }
              const state = readState();
              const decisions = (state.decisions ?? {}) as Record<string, unknown>;
              decisions[pitchId] = {
                decision,
                ...(decision === 'edit' ? { name, idea } : {}),
                at: new Date().toISOString(),
              };
              state.decisions = decisions;
              writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
              send(200, { ok: true });
            } catch (err) {
              send(400, { error: String(err) });
            }
          });
          return;
        }
        send(405, { error: 'GET or POST' });
      });
    },
  };
}

/** First non-internal IPv4 address, if any. */
function lanAddress(): string | null {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

/**
 * When the server is bound to the network (--host, e.g. dev:phone /
 * preview:phone), print the LAN URL prominently with a terminal QR code so a
 * phone camera can jump straight to it. Inert for plain localhost runs.
 */
function lanQrPlugin(): Plugin {
  const isNetworkHost = (host: string | boolean | undefined): boolean =>
    host === true || (typeof host === 'string' && host !== 'localhost' && host !== '127.0.0.1');

  const announce = (port: number): void => {
    const ip = lanAddress();
    if (!ip) return;
    const url = `http://${ip}:${port}/`;
    console.log('\n  ────────────────────────────────────────');
    console.log(`  PHONE URL (same Wi-Fi):  ${url}`);
    console.log('  Point the phone camera at this code:\n');
    qrcode.generate(url, { small: true });
    console.log('  ────────────────────────────────────────\n');
  };

  const hookListening = (httpServer: { once: (e: string, cb: () => void) => void; address: () => unknown } | null): void => {
    httpServer?.once('listening', () => {
      const addr = httpServer.address();
      if (addr && typeof addr === 'object' && 'port' in (addr as Record<string, unknown>)) {
        announce((addr as { port: number }).port);
      }
    });
  };

  return {
    name: 'tsh-lan-qr',
    configureServer(server) {
      if (isNetworkHost(server.config.server.host)) hookListening(server.httpServer);
    },
    configurePreviewServer(server) {
      if (isNetworkHost(server.config.preview.host)) hookListening(server.httpServer);
    },
  };
}

export default defineConfig({
  plugins: [react(), lanQrPlugin(), reviewPlugin()],
  server: {
    // `npm run tunnel` sets TSH_TUNNEL so the localtunnel hostname passes
    // Vite's Host-header check; normal runs keep the strict default.
    ...(process.env.TSH_TUNNEL ? { allowedHosts: ['.loca.lt'] } : {}),
    // LP Register: `npm run dev:api` serves the function locally on :3999.
    proxy: { '/api': 'http://localhost:3999' },
  },
  test: {
    // Game logic + content + server tests. All pure TS (no React, no DOM),
    // so the node environment is sufficient and fast.
    include: ['src/game/**/*.test.ts', 'src/content/**/*.test.ts', 'src/server/**/*.test.ts'],
    environment: 'node',
  },
});
