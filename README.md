# Term Sheet Happens

A satirical VC card-swipe roguelite. Swipe on founders, disappoint LPs, keep a
ledger. Mobile-first web (Vite + React 18 + TypeScript strict), fully offline,
wrapped for iOS with Capacitor. Design doc and standing rules live in [CLAUDE.md](CLAUDE.md).

## Requirements

- Node **22.6+** (the content/simulation CLIs run TypeScript via
  `--experimental-strip-types`).

## Development

```bash
npm install
npm run dev              # dev server at http://localhost:5173
npm test                 # Vitest: engine + content suites (incl. monte-carlo)
npm run validate-content # content schema, id/name uniqueness, idea length
npm run simulate -- --runs 500  # naive-strategy DPI distributions per tier
npm run build            # typecheck + production bundle -> dist/
npm run preview          # serve the production build locally
```

Append `?dev` to the URL for the cheat panel (tier jumps, autoplay,
force-DPI, share-card preview). Saves live in localStorage under `tsh.*`;
"Settings → Leave the industry" wipes them.

## Architecture (short version)

- `src/game/` — pure TS engine, zero React. A reducer over `GameState`;
  all randomness flows through a seeded RNG (`rngState` lives in the state,
  so runs replay exactly). Every tuning constant: `src/game/tuning.ts`.
- `src/content/` — all comedy copy as static JSON + validators. Adding a
  file to `src/content/pitches/` is the only step to add pitches
  (see `scripts/generate-pitches.md` for the batch-writing prompt).
- `src/ui/` — React + plain CSS, deal-memo aesthetic. No game math.
- `src/services/` — platform interfaces (`StorageService`, `ShareService`,
  `HapticsService`) with web and Capacitor implementations; `index.ts`
  picks one set at startup (the app's only platform check).
- `public/sw.js` — offline shell (cache-first hashed assets, network-first
  navigations). Registered in production builds only.

## Deploy (static)

`npm run build` emits a fully static site in `dist/` — no server, no env vars.

- **Netlify**: config ships in [netlify.toml](netlify.toml) (build command,
  publish dir, no-cache header for `sw.js`). Connect the repo and deploy.
- **Vercel**: zero-config — framework preset "Vite", build `npm run build`,
  output `dist`. Add a header rule for `/sw.js` → `Cache-Control: no-cache`
  if you customize caching.
- Anything else that serves static files works (GitHub Pages needs the app
  served from the domain root, since the SW scope and asset paths are `/`).

After the first visit the game plays fully offline; the service worker
serves the shell and content from cache.

## iOS (Capacitor → TestFlight)

`ios/` is a committed Xcode project (Swift Package Manager, no CocoaPods).
The web bundle it embeds is generated (and gitignored), so run a sync after
cloning and after every web change:

```bash
npm run ios:sync   # build + copy dist/ into the iOS project
npm run ios        # same, then open Xcode
```

App id `game.termsheethappens` (in `capacitor.config.ts` and the Xcode
target). In Xcode: pick your team under Signing & Capabilities, bump the
build number, then Product → Archive → Distribute App → App Store Connect.
The app icon is `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (1024px,
no alpha).

Native builds use Capacitor Preferences for saves (not localStorage), the
native share sheet, and real haptics.
