/**
 * Steam desktop shell (Electron main process). Gates on Steam ownership, then
 * shows the unchanged web build from `dist/`. The page gets no preload and no
 * IPC: the game runs exactly as it does in a browser.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, Menu, net, protocol } from 'electron';
import type { SteamworksSDK } from 'steamworks-ffi-node';

// Spacewar, Valve's public test app, until the game's own App ID exists.
// TODO: real App ID (also in desktop/steam/*.vdf).
const APP_ID = 480;
const PRODUCT_NAME = 'Term Sheet Happens';
// The page's origin. Never change it after release: localStorage saves are keyed by it.
const APP_ORIGIN = 'app://game';
// --paper-dim, the backdrop behind the phone column (src/index.css).
const BACKDROP = '#E8E4D8';
// Steam wants its callbacks pumped even when nothing listens for them.
const STEAM_CALLBACK_MS = 1000;

const dev = !app.isPackaged;
// No Steam at all:
// - `npm run desktop:dev:nosteam` sets TSH_NO_STEAM=1, to work on the game
//   without the client. Only dev runs read the variable.
// - `npm run desktop:local` packages a build for colleagues without the Steam
//   binding or library, flagged in its package.json (electron-builder.local.yml).
// A Steam build always checks ownership.
const skipSteam = dev
  ? process.env.TSH_NO_STEAM === '1'
  : JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8')).tshNoSteam === true;

// Everything up to `whenReady` must run before the app's ready event.
protocol.registerSchemesAsPrivileged([
  // No service workers: the files are already local, so /sw.js just fails to register.
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
]);
// Electron has no Web Share backend, so navigator.share would reject and the
// game's share chain would read it as "cancelled". Without it, sharing falls
// through to the clipboard.
app.commandLine.appendSwitch('disable-blink-features', 'WebShare');
app.setName(PRODUCT_NAME);
// One save location for dev and packaged builds.
app.setPath('userData', path.join(app.getPath('appData'), PRODUCT_NAME));

if (!app.requestSingleInstanceLock()) app.quit();

let steam: SteamworksSDK | null = null;
let steamPump: NodeJS.Timeout | null = null;
let mainWindow: BrowserWindow | null = null;

/** True once Steam is up and this account owns the game. */
async function steamGate(): Promise<boolean> {
  // Loaded here rather than imported up top, so no-Steam builds can leave it out.
  const sdk = (await import('steamworks-ffi-node')).SteamworksSDK.getInstance();
  sdk.setSdkPath(
    dev ? path.join(import.meta.dirname, '..', 'steamworks_sdk') : path.join(process.resourcesPath, 'steamworks_sdk'),
  );
  // Launched from Finder instead of Steam: Steam relaunches us. Dev runs use
  // the SteamAppId that init() sets, so they never restart.
  if (!dev && sdk.restartAppIfNecessary(APP_ID)) {
    app.quit();
    return false;
  }
  // Init fails when Steam isn't running or this account has no license.
  if (!sdk.init({ appId: APP_ID }) || !sdk.apps.isSubscribedApp(APP_ID)) {
    dialog.showErrorBox('Steam is required', `Launch ${PRODUCT_NAME} from your Steam library.`);
    app.quit();
    return false;
  }
  steam = sdk;
  steamPump = setInterval(() => sdk.runCallbacks(), STEAM_CALLBACK_MS);
  return true;
}

/** Serves `dist/` at app://game/, refusing anything outside it. */
function serveDist(): void {
  const root = path.join(app.getAppPath(), 'dist');
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      // Also what makes Cmd+C / Cmd+V work in the name fields.
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'togglefullscreen' },
          ...(dev ? [{ type: 'separator' as const }, { role: 'reload' as const }, { role: 'toggleDevTools' as const }] : []),
        ],
      },
      { role: 'windowMenu' },
    ]),
  );
}

function createWindow(): void {
  const win = new BrowserWindow({
    title: PRODUCT_NAME,
    // The game is a 430×932 phone column on a paper backdrop; any size works.
    useContentSize: true,
    width: 520,
    height: 960,
    minWidth: 430,
    minHeight: 700,
    backgroundColor: BACKDROP,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: dev,
    },
  });
  win.once('ready-to-show', () => win.show());
  // The page never leaves the game: no popups, no navigating away.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const devUrl = process.env.TSH_DEV_URL;
  const start = devUrl ?? `${APP_ORIGIN}/index.html`;
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(start).origin) event.preventDefault();
  });
  void win.loadURL(start);
  win.on('closed', () => {
    mainWindow = null;
  });
  mainWindow = win;
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

// Closing the window ends the session (on macOS too), so Steam stops the playtime clock.
app.on('window-all-closed', () => app.quit());

app.on('before-quit', () => {
  if (!steam || !steamPump) return;
  clearInterval(steamPump);
  steamPump = null;
  steam.shutdown();
});

void app.whenReady().then(async () => {
  if (skipSteam) console.log('[desktop] no-Steam build: skipping the Steam gate');
  else if (!(await steamGate())) return;
  serveDist();
  buildMenu();
  createWindow();
});
