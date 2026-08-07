/**
 * `npm run tunnel` — dev server + public URL for when LAN is blocked.
 * Starts vite bound to the network, then exposes it via localtunnel and
 * prints the public URL (with QR). Ctrl-C tears both down.
 */

import { spawn } from 'node:child_process';
import localtunnel from 'localtunnel';
import qrcode from 'qrcode-terminal';

const PORT = 5173;

const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', String(PORT), '--strictPort'], {
  stdio: 'inherit',
  // Lets vite.config allow the *.loca.lt Host header for this run only.
  env: { ...process.env, TSH_TUNNEL: '1' },
});
vite.on('exit', (code) => process.exit(code ?? 0));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://localhost:${PORT}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`vite never answered on :${PORT}`);
}

try {
  await waitForServer();
  const tunnel = await localtunnel({ port: PORT });

  // localtunnel greets first-time visitors with an interstitial that asks
  // for the tunnel password, which is just this machine's public IP.
  let publicIp = 'unknown (visit https://ipv4.icanhazip.com)';
  try {
    publicIp = (await (await fetch('https://ipv4.icanhazip.com')).text()).trim();
  } catch {
    /* offline lookup is non-fatal */
  }

  console.log('\n  ════════════════════════════════════════');
  console.log(`  PUBLIC URL:       ${tunnel.url}`);
  console.log(`  Tunnel password:  ${publicIp}`);
  console.log('  (localtunnel shows a one-time password page; paste the IP above)');
  console.log('  Point the phone camera here:\n');
  qrcode.generate(tunnel.url, { small: true });
  console.log('  ════════════════════════════════════════\n');

  const shutdown = () => {
    tunnel.close();
    vite.kill('SIGINT');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  tunnel.on('close', () => vite.kill('SIGINT'));
} catch (err) {
  console.error('Tunnel failed:', err);
  vite.kill('SIGINT');
  process.exit(1);
}
