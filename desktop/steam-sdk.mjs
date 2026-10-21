/**
 * `npm run steam:sdk -- <steamworks_sdk_XXX.zip>`: copies the Steamworks
 * redistributables the desktop build ships out of Valve's SDK zip into
 * desktop/steamworks_sdk/ and pins their version + checksums in
 * desktop/steamworks-sdk.json.
 *
 * The files stay gitignored: the repo is public, and Valve's license only
 * allows redistributing them inside the game. `--verify` checks the installed
 * copy against the pin; the desktop scripts run it so every machine packages
 * the same bytes.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SDK_DIR = path.join(import.meta.dirname, 'steamworks_sdk');
const PIN = path.join(import.meta.dirname, 'steamworks-sdk.json');
// What the app needs from the zip, relative to its `sdk/` folder.
const FILES = ['redistributable_bin/osx/libsteam_api.dylib'];

const rel = (p) => path.relative(process.cwd(), p);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function fail(message) {
  console.error(`steam-sdk: ${message}`);
  process.exit(1);
}

function verify() {
  const pin = JSON.parse(fs.readFileSync(PIN, 'utf8'));
  const fix = `Run: npm run steam:sdk -- <steamworks_sdk_${pin.version.replace('.', '')}.zip> (partner.steamgames.com/downloads)`;
  for (const [file, hash] of Object.entries(pin.files)) {
    const dest = path.join(SDK_DIR, file);
    if (!fs.existsSync(dest)) fail(`missing ${rel(dest)}. ${fix}`);
    if (sha256(fs.readFileSync(dest)) !== hash) fail(`${rel(dest)} isn't the pinned SDK ${pin.version}. ${fix}`);
  }
  console.log(`steam-sdk: Steamworks SDK ${pin.version} OK`);
}

function install(zip) {
  if (!fs.existsSync(zip)) fail(`no such file: ${zip}`);
  const unzip = (entry) => {
    try {
      return execFileSync('unzip', ['-p', zip, `sdk/${entry}`], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      fail(`${zip} has no sdk/${entry}. Is it a Steamworks SDK zip?`);
    }
  };
  // The readme's changelog starts with the newest release, e.g. "v1.65 23th July 2026".
  const version = /^v(\d+\.\d+)/m.exec(unzip('Readme.txt').toString('latin1'))?.[1];
  if (!version) fail(`can't read the SDK version from sdk/Readme.txt in ${zip}`);

  const files = {};
  for (const file of FILES) {
    const buf = unzip(file);
    const dest = path.join(SDK_DIR, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    files[file] = sha256(buf);
  }
  fs.writeFileSync(PIN, JSON.stringify({ version, files }, null, 2) + '\n');
  console.log(`steam-sdk: installed Steamworks SDK ${version} into ${rel(SDK_DIR)}/, pinned in ${rel(PIN)}`);
}

const arg = process.argv[2];
if (arg === '--verify') verify();
else if (arg) install(path.resolve(arg));
else fail('usage: npm run steam:sdk -- <steamworks_sdk_XXX.zip>   |   node desktop/steam-sdk.mjs --verify');
