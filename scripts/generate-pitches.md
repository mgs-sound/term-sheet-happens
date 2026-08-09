# Pitch batch generator — reusable prompt template (revised tone)

Target pool: **400 curated pitches** (~40/sector). Generate wide, curate hard
in review mode (`?review=1`), apply with `npm run apply-review`.

## The bar (revised)

**A pitch sounds like a real deck until exactly one clause.** Everything
before the twist must survive a partner meeting. The twist is one late
clause — pricing, a metric caveat, a governance detail — not the premise.

### Calibration — PASSES (subtle)

- *"Collision-risk forecasting for satellite operators, priced per near miss."*
  — real product; only the pricing clause turns.
- *"Per-seat pricing for companies that have no employees yet."*
  — a real SaaS motion; the twist is who it's sold to, arriving last.
- *"Institutional custody with three of five keys held by people who have met."*
  — sounds like a compliance page until the final subclause.

### Calibration — FAILS (too absurd)

- *"Blockchain for receipts. The receipts are also on a blockchain."*
  — double twist; no real deck ever existed.
- *"AI that attends your meetings and quietly resigns on your behalf."*
  — the premise itself is the joke; nothing to nod along with first.
- *"Twelve AI agents in a trench coat, billed as a consultancy."*
  — visual gag; fails the "could open a partner meeting" test.

## How to use

1. Fill `{{SECTOR}}` (one of `AI SaaS Fintech Consumer Climate Health Crypto
   Gaming Space Food`), `{{COUNT}}` (20–30), and `{{EXISTING_NAMES}}` (all
   names already in `src/content/pitches/*.json`).
2. Save output as `src/content/pitches/<sector-lowercase>-batch<N>.json`
   (auto-discovered). Run `npm run validate-content` — it lints tone smells.
3. Review every card in `?review=1`; `npm run apply-review` commits decisions.

## The prompt

```text
You are writing pitch cards for "Term Sheet Happens", a satirical VC
card-swipe game. Write {{COUNT}} pitches for the {{SECTOR}} sector.

OUTPUT FORMAT — raw JSON only, no prose, no code fences:
{ "pitches": [ { "id": "<sector-lowercase>-<name-kebab-case>",
    "name": "<company name>", "idea": "<the one-liner>",
    "sector": "{{SECTOR}}" } ] }

THE BAR (non-negotiable): each idea must sound like a REAL company —
something a tired associate would type into a memo without blinking —
until EXACTLY ONE clause, arriving late in the sentence, turns it.
The joke is a detail of the business (pricing, metric, caveat,
governance), never the premise.

RULES:
- Deadpan. No winking, no shouting, no exclamation marks.
- UNDER 20 WORDS. The twist never arrives in the first five words.
- Possible physics only. If the product cannot exist, discard it.
- One twist. If a second clause is also funny, cut one.
- Banned tics: "literally", "just", trailing "Wait—" constructions,
  ALL-CAPS words, puns as the whole joke.
- Names: 1–3 words, plausible startup branding. Never real companies
  or people.
- Satire targets the industry and the business model, not identities.

SELF-CHECK — for each pitch before output: (1) would the first ten
words pass in a real deck? If not, discard. (2) Does the twist arrive
in the first five words, or require impossible physics? Discard.
(3) Read it aloud flat; if it needs a funny voice, discard.

DO NOT reuse or lightly reskin any existing name:
{{EXISTING_NAMES}}
```

## Schema (enforced by `npm run validate-content`)

id: globally unique `<sector>-<name-kebab>` · name: unique, 1–3 words ·
idea: ≤20 words, lint-clean · sector: canonical string. File shape:
`{ "_source": "<who/when>", "pitches": [...] }`.
