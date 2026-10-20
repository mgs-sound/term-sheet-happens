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

## One-time setup

1. Download the Steamworks SDK zip from <https://partner.steamgames.com/downloads/list> (partner login).
2. Copy its `sdk/redistributable_bin/osx/libsteam_api.dylib` to `desktop/steamworks_sdk/redistributable_bin/osx/libsteam_api.dylib` (gitignored; Valve's license doesn't allow redistributing it outside the game).
3. Until the game has its own App ID, everything runs as Spacewar (480). Swap in the real ID in:
   - `APP_ID` in `desktop/main.ts`;
   - `AppID` and the depot ID in `desktop/steam/app_build.vdf`.

## Running it

The Steam client must be running and logged in.

- **Against the Vite dev server:** `npm run dev`, then `npm run desktop:dev`. Devtools and reload are in the View menu.
- **Against the real bundle (the `app://` path that ships):** `npm run build && npm run desktop:build && npx electron .`.
- Dev runs never relaunch through Steam. Saves live in `~/Library/Application Support/Term Sheet Happens/`, apart from the browser's.

## Packaging

`npm run desktop` → `release/mac-universal/Term Sheet Happens.app` (universal arm64 + x64).

**Signing** uses "Developer ID Application: Sound Games Inc. (JA5UT773C5)" from the keychain (pinned as `mac.identity` in `electron-builder.yml`). For an unsigned local build, set `CSC_IDENTITY_AUTO_DISCOVERY=false`.

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

## Uploading to Steam

1. **Partner site, once:**
   - Add a macOS depot.
   - Add a launch option: executable `Term Sheet Happens.app`, OS macOS.
2. **Upload:** `STEAM_USER=<build account> npm run steam:upload`. This needs `steamcmd`, e.g. `brew install --cask steamcmd`.
   - It uploads `release/mac-universal/` using `desktop/steam/app_build.vdf`.
   - Set `SetLive` there to a beta branch to push straight to testers.
3. **Test the installed copy:** install from a beta branch through the Steam client on another Mac (Intel too, if possible), then run `codesign --verify --deep --strict` on the copy Steam installed. This makes sure the depot kept the framework symlinks.
