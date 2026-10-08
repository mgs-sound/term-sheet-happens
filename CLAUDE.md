# Term Sheet Happens

A satirical VC card-swipe roguelite. Mobile-first web (Vite + React 18 + TypeScript strict), Capacitor-ready.

## Standing rules (non-negotiable)

1. **Game logic stays React-free.** Everything in `src/game/` is pure TypeScript with zero React imports. UI subscribes to game state; it never owns rules.
2. **All gameplay constants live in [src/game/tuning.ts](src/game/tuning.ts).** No magic numbers inside systems. New constants get a comment; guesses get a `TUNE` marker.
3. **All platform features go behind the interfaces in `src/services/`** (`StorageService`, `ShareService`, `HapticsService`). Capacitor later swaps implementations only — no platform checks in game or UI code.
4. **Pointer events only.** No mouse/hover-dependent UI, no touch/mouse event forks.
5. **Fully offline.** 100% client-side; no backend, no SSR, no network calls of any kind. All content ships as static JSON in `src/content/`.
6. **Seeded RNG everywhere.** All game randomness flows through an injected `RNG` from [src/game/rng.ts](src/game/rng.ts) — never `Math.random` — so runs are reproducible in tests.
7. **Keep the deal-memo aesthetic rules exactly** (see Visual identity below). The reference JSX in `reference/` is authoritative for feel.
8. **All player-facing comedy copy lives in content JSON** (`src/content/`) — pitches, theses, firm names, rehire/veto/founder-walk/zombie-jab lines, LP quirks, verdicts, harvest labels. None of it is hardcoded in game logic or UI.

## Folder structure

- `src/game/` — pure TS game logic, ZERO React imports. Vitest covers this.
- `src/content/` — static JSON content + TS loaders/types/validators. Pitches live in `pitches/*.json` (one file per sector batch); adding a JSON file there is the only step to add content (auto-discovered via `import.meta.glob`). New batches: follow `scripts/generate-pitches.md`, then run `npm run validate-content`.
- `src/ui/` — React components + plain CSS (no UI framework, no Tailwind).
- `src/services/` — platform interfaces + web implementations.
- `reference/` — `term-sheet-happens.jsx`, the authoritative prototype. Never imported; port from it.

No router library — simple phase-based screen state.

Commands: `npm run dev`, `npm test` (Vitest over `src/game` + `src/content`), `npm run build` (typecheck + bundle), `npm run validate-content` (content schema, id/name uniqueness, sector validity, idea length), `npm run simulate -- --runs N` (naive-strategy DPI distributions per tier, for tuning `tuning.ts`).

---

# Design doc

## What it is

A satirical VC card-swipe roguelite. Reigns/Tinder loop: each run is one fund at a generated firm ("Adverse Selection & Sons") with an assigned comedy thesis you're pressured to stay inside. Swipe left to pass, right to invest. Time passes, exits land, the fund closes on a DPI scorecard.

## Pillars

1. **Every swipe is a joke AND a decision** — comedy and mechanics in the same beat.
2. **Short first run, deep career** — Fund I is a 3-minute doomed tutorial; the meal opens after.
3. **Built to be screenshotted** — the scorecard is the marketing; failure shares are funnier than wins.

## Run structure

- **Fund I (always):** $8–10M, ~15 meetings, simplified rules (sign-at-ask only, no sliders), deck quietly stacked toward mediocrity, aggressive partner vetoes. Most players fail (~0.3–0.8x). Ends with the rehire card: "Somehow, you've been hired again. The industry has no long-term memory."
- **Fund II+:** ~25 meetings (repeat Associate), 30 on your first Partner fund, 40 after that and as GP — full systems. Growth should feel like growth (15 → 30 → 40); 50 felt like a punishment.

## Career ladder (promotion = poaching, unless you earned the right to stay)

- **Stay or leave (rehire inbox):** meet every LP request (or return 1.25x+, which buys forgiveness) and you may stay at your firm — unless the fund returned 0.2x or less, in which case the firm folds and everyone leaves (same firm + thesis; below 1x the fund isn't shrunk, at 1x+ you're promoted in-house with a bigger fund). Otherwise you take one of the new-firm offers (three: Big checks / Deal flow / LP darling; after a 1x+ fund a Mega fund — one rung down — takes Big checks' slot). Staying is a known number; leaving is a sealed envelope: the inbox shows only the possible fund/trust range in one sentence (its low end under the stay fund), and each offer's real terms swing inside it until you open the letters.

- **Associate** → return 1x+ → poached to **Partner** at a new firm (board seats unlock, bigger fund).
- **Partner** → return 2x+ → **GP**: choose between three LP offer packages (fund size + assigned thesis + a quirk), name your own firm (or reroll generated names).
- **Big funds:** a fund with more money per meeting than its rung's usual writes bigger checks (card asks/valuations scale up; ownership and multiples unchanged) so it's actually deployable — and its LPs pile on stricter requests (3–4, or 4–5 for the biggest: team 4+, heat ≤2, …).
- **GP:** DPI sizes the next fund (AUM is the career score). Capital calls become a hazard.
- **Endgame:** 3x+ on a $200M+ fund with maxed reputation = **Enlightenment**. Final card: a young associate pitches YOU their fund — you swipe on them. Credits. Endless mode unlocks.

## Core systems

- **Pitch card:** name, one-liner idea, sector, stage, team (1–5), traction (1–5), ARR, deal heat (1–5), ask + valuation, ON-THESIS tab when applicable. Hidden quality drives outcomes.
- **Sign vs Negotiate (Fund II+):** swipe right offers SIGN AT ASK (instant, full price) or NEGOTIATE (check + valuation sliders, 1 counter round, better entry improves exit multiple, risk of founder walking; high heat jacks demands). From Partner up, a final offer below the founder's counter is settled by skill, not dice, with one of four minigames (equal odds): **sword in the stone** — tap to pull it out within 5s; the taps needed (~30–44) come from how acceptable the offer was — or the **blind wheel** — spin it and watch two turns in plain sight, then a cover drops over the wheel; stop it when you think the slice is under the pointer (constant speed; slice 24°–90° by acceptability) — or **shoot the cranes** — the deal, an origami crane, peeks out of a bush then flies in a parabola to the other one across a red pole; three fly in turn (a slow warm-up, then two devilishly fast, alternating bushes), one shot each, fire as it crosses; hit 2 of 3 (hit window 80–220ms by acceptability) — or **flappy crane** — tap to flap the crane through five green triangles (from the ceiling, the floor or both; course differs every run, gaps wider by acceptability); touch one and the deal is gone. Physics is pure (`src/game/flappy.ts`): the engine replays the taps to judge.
- **Thesis / LP Trust:** deck ~60/40 on/off thesis. Off-thesis checks drain LP Trust; low trust shrinks the next fund. An off-thesis deal that exits big flips to a "visionary" reputation spike. Tunable temptation, not a wall.
- **Reputation:** 5 stages, DOG WATER → TOURIST → CREDIBLE → HEAT MAGNET → ENLIGHTENED. Passing too much decays it (zombie-fund jabs); hot deals and exits raise it.
- **Partner vetoes (Associate only):** after terms agree, chance the partner kills it (higher if off-thesis / low traction). Vetoed companies are tracked; if one would have been a unicorn, the harvest shows the heartbreak.
- **Follow-ons / reserves (flagship meal mechanic, Fund II+):** portfolio companies raise again mid-run as interrupt cards — take pro rata or get diluted. Reserves management is the skill.
- **Board seats (Partner+):** a buff with risk, decided at signing (costs some acceptance when negotiating). At harvest a seated company's exit pays ×1.2, but if it goes to zero the seat is a liability: −50% of what you put in (legal fees). Worth it on strong team/traction, a loss on weak ones. A fund whose legal fees eat past every exit (returned < $0) **ends the career**: resignation letter, fresh name, obituary on the ledger.
- **Bridge rounds (Partner+)** and **capital calls (GP):** designed in engine, gated by tier.
- **Exit sim:** resolved mostly at harvest (5-year fast-forward), occasional mid-run markup/shutdown toasts. Outcome distribution keyed to hidden quality; negotiated entry price scales the payout.

## Persistence & sharing

- **Career Ledger:** one ruled line per fund ever run (firm, thesis, tier, DPI, verdict). Career profile: AUM, total returned to LPs, best fund, unicorns found, vetoed-unicorns-you-were-right-about, Enlightenment status.
- **Versioned save schema** behind a `StorageService` interface (localStorage now, Capacitor Preferences later).
- **Share:** canvas-rendered PNG of the scorecard memo → `navigator.share()` (files) with clipboard/text fallbacks. Headline flex: "returned $X to LPs."

## Content

~400 curated pitches across 10 sectors (AI, SaaS, Fintech, Consumer, Climate, Health, Crypto, Gaming, Space, Food); firm names from prefix+suffix generator; ~12+ theses each pinning 2 sectors with a one-liner. Generate wide with AI, curate hard — every card must land.

## Visual identity

Deal-memo paper aesthetic. Paper `#F7F5EE`/`#FDFCF7`, ink `#1C1B17`, ledger green `#1E6B4E`, stamp red `#B3382C`, sign-here yellow `#F5D547`. Serif (Georgia stack) for document text, monospace for numbers. Rubber-stamp PASS/OFFER on swipe. Hard-edged borders with offset block shadows — **no rounded corners, no gradients, no glassmorphism**. Sole exception: the partner-challenge minigame graphics (die, playing cards, sticks, ruler, cover) have soft corners; their panel, buttons, tags and the result stamp stay square. The reference JSX is authoritative for feel.

## Tech rules (Capacitor-readiness)

- 100% client-side; no backend, no SSR, no server calls. All content ships as static JSON.
- Pointer events only (no mouse/hover-dependent UI). Portrait, mobile-first, max-width column, `env(safe-area-inset-*)` respected. No text selection on game surfaces, no rubber-band scroll.
- All platform touchpoints behind interfaces: `StorageService`, `ShareService`, `HapticsService` (no-op on web). Capacitor later swaps implementations only.
- Game logic is pure TypeScript with zero React imports; seeded RNG for deterministic tests; every tuning constant lives in one `tuning.ts`.
