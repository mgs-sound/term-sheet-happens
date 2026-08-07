import os from 'node:os';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import qrcode from 'qrcode-terminal';

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
  plugins: [react(), lanQrPlugin()],
  // `npm run tunnel` sets TSH_TUNNEL so the localtunnel hostname passes
  // Vite's Host-header check; normal runs keep the strict default.
  ...(process.env.TSH_TUNNEL ? { server: { allowedHosts: ['.loca.lt'] } } : {}),
  test: {
    // Game logic + content tests. Both are pure TS (no React, no DOM),
    // so the node environment is sufficient and fast.
    include: ['src/game/**/*.test.ts', 'src/content/**/*.test.ts'],
    environment: 'node',
  },
});
