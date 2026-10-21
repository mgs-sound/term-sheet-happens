/**
 * `npm run desktop:dev[:nosteam]`: starts the Vite dev server, opens Electron
 * on whatever URL it got (another port if 5173 is taken), and stops the server
 * when the app quits. No separate `npm run dev` needed.
 */

import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

const server = await createServer();
await server.listen();
server.printUrls();

const app = spawn(electron, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, TSH_DEV_URL: server.resolvedUrls.local[0] },
});
app.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
