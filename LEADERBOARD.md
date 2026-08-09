# The LP Register (leaderboard)

The game's only backend: one Vercel function ([api/leaderboard.ts](api/leaderboard.ts))
over Upstash Redis (a sorted set). Everything else stays fully offline, and
the game never blocks on this — unreachable submissions queue in the save
and retry on next launch.

## Provisioning (one time)

1. Vercel dashboard → your project → **Storage** → **Create database** →
   Marketplace → **Upstash** (Redis). Connect it to the project.
2. The integration injects `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` into the project env automatically.
3. Add `LEADERBOARD_ADMIN_TOKEN` yourself (Project → Settings → Environment
   Variables) — any long random string; it guards the wipe endpoint.
4. Redeploy. Until env vars exist the endpoint returns 503 and the game
   shows its unreachable state; nothing breaks.

## Local dev

```bash
npm run dev:api   # in-memory register on :3999 (no Redis needed)
npm run dev       # vite proxies /api -> :3999
```

State resets when `dev:api` restarts. `vercel dev` also works once the env
vars are pulled (`npx vercel env pull`).

## Data model

- `lb:global` — ZSET: member = careerId (client UUID), score = totalReturnedM.
- `lb:career:{id}` — HASH: name, bestFundDpi, bestFundSizeM, updatedAt.
- `lb:careers` — SET of ids (for clean wipes).
- `lb:rl:{ip}` — submission rate counter (10/hour, 1h expiry).

## Honesty limitations (by design, for now)

Scores are **client-reported**. A motivated cheater can POST any number up
to the plausibility caps (`LEADERBOARD` in [tuning.ts](src/game/tuning.ts):
$50B returned, 50x DPI) with any UUID. Mitigations in place: server-side
caps, name moderation (blocklist + lookalike collapse — edit
[name-blocklist.json](src/content/name-blocklist.json)), IP rate limiting.
Real verification would need server-simulated runs (the engine is
deterministic per seed, so replaying a submitted seed+action log is the
future path) — out of scope for this phase.

## Wiping the board

```bash
curl -X DELETE https://<your-app>.vercel.app/api/leaderboard \
  -H "x-admin-token: $LEADERBOARD_ADMIN_TOKEN"
```

Deletes the board, career metadata, and the id set. Rate-limit counters
expire on their own.
