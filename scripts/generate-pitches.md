# Pitch batch generator — reusable prompt template

Target pool: **400 curated pitches** (~40/sector across the 10 sectors).
Philosophy per the design doc: **generate wide with AI, curate hard — every
card must land.** Expect to cut at least half of every generated batch.

## How to use

1. Fill the three `{{PLACEHOLDERS}}` in the prompt below.
   - `{{SECTOR}}` — exactly one of: `AI`, `SaaS`, `Fintech`, `Consumer`,
     `Climate`, `Health`, `Crypto`, `Gaming`, `Space`, `Food`.
   - `{{COUNT}}` — batch size (20–30 works well; you'll cut most).
   - `{{EXISTING_NAMES}}` — paste every company name already in
     `src/content/pitches/*.json` for that sector (prevents dupes).
2. Run the prompt, save the output as
   `src/content/pitches/<sector-lowercase>-batch<N>.json`
   (e.g. `ai-batch2.json`). The loader discovers new files automatically —
   no code changes.
3. Run `npm run validate-content`. Fix anything it flags.
4. **Curate.** Delete every pitch that doesn't land on first read. Keep the
   file; the validator and loader handle any batch size.

## The prompt

```text
You are writing pitch cards for "Term Sheet Happens", a satirical VC
card-swipe game. Each card is a fake startup the player must fund or pass.

Write {{COUNT}} pitches for the {{SECTOR}} sector.

OUTPUT FORMAT — reply with raw JSON only, no prose, no code fences:
{
  "pitches": [
    { "id": "<sector-lowercase>-<name-kebab-case>",
      "name": "<company name>",
      "idea": "<the one-liner>",
      "sector": "{{SECTOR}}" }
  ]
}

TONE RULES (non-negotiable):
- Deadpan. The idea is delivered completely straight, like a real one-line
  pitch. The joke is the business, never the phrasing winking at you.
- Specific. Name the mechanism, the number, the customer. "An app for dogs"
  is dead; "a doorbell-camera social feed; crime is down, suspicion is way
  up" lives.
- Exactly ONE twist per idea. Set up a plausible startup, turn it once.
  Never stack a second joke on top.
- UNDER 20 WORDS per idea. Shorter is funnier.
- Company names: 1–3 words, plausible startup branding (portmanteaus,
  dropped vowels, '-ly', '& Sons' energy). Never real companies.
- No puns as the whole joke. No "Uber for X" unless the X is the twist.
- Satire targets the industry and the business model, not founders'
  identities. Nothing mean-spirited about real people or groups.

CALIBRATION — these four are the bar. Match this energy:
- Synergly (AI): "AI that attends your meetings and quietly resigns on your
  behalf."
- Seatless (SaaS): "Per-seat pricing for companies that have no employees
  yet."
- Steadycoin (Crypto): "A stablecoin pegged to the founder's confidence."
- Phantom Fork (Food): "One kitchen operating as fourteen restaurants, all
  rated 4.6."

DO NOT reuse or lightly reskin any of these existing names:
{{EXISTING_NAMES}}
```

## Schema reference (enforced by `npm run validate-content`)

| Field    | Rule                                                        |
| -------- | ----------------------------------------------------------- |
| `id`     | globally unique, `<sector-lowercase>-<name-kebab-case>`     |
| `name`   | non-empty, unique across ALL sectors (case-insensitive)     |
| `idea`   | non-empty, max 20 words                                     |
| `sector` | one of the 10 canonical sector strings, matches `types.ts`  |

File shape: `{ "_source": "<who wrote it, when>", "pitches": [ ... ] }`.
Always set `_source` so curation history stays traceable.
