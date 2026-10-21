# Steam desktop build (macOS)

`desktop/main.ts` is the whole shell. It's an Electron main process that:

- checks Steam ownership before any window exists;
- serves the unchanged web build (`dist/`) at `app://game`.

Nothing in `src/` knows it's on Steam. Because Electron isn't Capacitor's native platform, the web services are picked: localStorage, the share chain falling through to the clipboard, and no haptics.

## Launch gate

1. **Launched outside Steam** (e.g. from Finder): `restartAppIfNecessary` makes Steam relaunch the app. This happens in packaged builds only.
2. **Init:** `init` fails if Steam isn't running or this account has no license for the app.
   - On failure: a "Steam is required" dialog, then quit.
   - Steam offline mode still passes.

## One-time setup (per machine)

The Steamworks redistributable (`libsteam_api.dylib`) is **not in git**: the repo is public, and Valve's license only allows redistributing it inside the game.

`desktop/steamworks-sdk.json` pins the SDK version and the file's SHA-256 (currently **1.65**). Every machine installs the identical file from Valve's zip:

1. Download `steamworks_sdk_165.zip` from <https://partner.steamgames.com/downloads/list> (partner login).
2. Run `npm run steam:sdk -- ~/Downloads/steamworks_sdk_165.zip`. This extracts the file into `desktop/steamworks_sdk/` (gitignored).

`desktop:dev` and `desktop` verify the installed copy against the pin first, and stop with instructions if it's missing or different.

**To move to a newer SDK:** run `steam:sdk` with the new zip. It rewrites the pin; commit `steamworks-sdk.json`, and everyone else runs `steam:sdk` with the same zip.

**App ID:** until the game has its own, everything runs as Spacewar (480). Swap in the real ID in:
- `APP_ID` in `desktop/main.ts`;
- `AppID` and the depot ID in `desktop/steam/app_build.vdf`.

## Running it

Both dev scripts start the Vite dev server themselves (on 5173, or the next free port), open Electron on it, and stop the server when you quit. Devtools and reload are in the View menu.

- **With Steam:** `npm run desktop:dev`. The Steam client must be running and logged in. Dev runs never relaunch through Steam.
- **Without Steam:** `npm run desktop:dev:nosteam`. It sets `TSH_NO_STEAM=1`, which skips the whole gate: no Steam library loaded, no "Steam is required" dialog. You don't need the SDK or the Steam client. Packaged builds ignore the variable, so it can't be used to skip the ownership check (for a packaged build without Steam, see [Build for colleagues](#build-for-colleagues-no-steam)).
- **Against the real bundle (the `app://` path that ships):** `npm run build && npm run desktop:build && npx electron .`. Add `TSH_NO_STEAM=1` in front to skip Steam.

Saves live in `~/Library/Application Support/Term Sheet Happens/`, apart from the browser's.

## Packaging

`npm run desktop` → `release/mac-universal/Term Sheet Happens.app` (universal arm64 + x64).

**Signing** uses "Developer ID Application: Sound Games Inc. (JA5UT773C5)" (pinned as `mac.identity` in `electron-builder.yml`). That certificate and its private key must be in the building machine's keychain: export it as a .p12 from a Mac that has it.

On a machine without it, make an unsigned local build with `npm run desktop -- -c.mac.identity=null`. That build is for testing only; Steam builds must be signed.

**Notarization** runs when these env vars are set:

```sh
export APPLE_API_KEY=~/keys/AuthKey_XXXXXXXXXX.p8   # App Store Connect API key
export APPLE_API_KEY_ID=XXXXXXXXXX
export APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Check the result:**

```sh
codesign --verify --deep --strict --verbose=2 "release/mac-universal/Term Sheet Happens.app"
spctl -a -vv "release/mac-universal/Term Sheet Happens.app"
xcrun stapler validate "release/mac-universal/Term Sheet Happens.app"
```

## Build for colleagues (no Steam)

`npm run desktop:local` → `release/local/Term Sheet Happens-<version>-universal-mac.zip`.

- **What it is:** the Steam build minus Steam (`electron-builder.local.yml`). There's no Steam binding and no `libsteam_api.dylib`, and the app skips the ownership gate. It runs without a Steam client or account, and building it doesn't need the SDK.
- **How the app knows:** the packaged `package.json` carries `"tshNoSteam": true`. That flag, not an env var, is what makes it skip the gate.
- **Signing:** signed and notarized exactly like the Steam build.
- **Keep it off Steam:** it goes to `release/local/`, away from what `steam:upload` ships. It's DRM-free, so never upload it to Steam.

**Notarize it before sending it** by setting the `APPLE_API_*` vars above. macOS blocks a downloaded app that's signed but not notarized. Each colleague would then have to try opening it once, then click **Open Anyway** in System Settings → Privacy & Security.

## Uploading to Steam

1. **Partner site, once:**
   - Add a macOS depot.
   - Add a launch option: executable `Term Sheet Happens.app`, OS macOS.
2. **Upload:** `STEAM_USER=<build account> npm run steam:upload`. This needs `steamcmd`, e.g. `brew install --cask steamcmd`.
   - It uploads `release/mac-universal/` using `desktop/steam/app_build.vdf`.
   - Set `SetLive` there to a beta branch to push straight to testers.
3. **Test the installed copy:** install from a beta branch through the Steam client on another Mac (Intel too, if possible), then run `codesign --verify --deep --strict` on the copy Steam installed. This makes sure the depot kept the framework symlinks.
