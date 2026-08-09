/**
 * `npm run apply-review` — commits review-mode decisions to the content
 * files: killed pitches move to src/content/graveyard/<sector>.json, edits
 * apply in place, and a per-sector summary shows where the pool thins.
 * Applied decisions (kill/edit) are cleared from the state file; keep/flag
 * markers stay for future sessions.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const contentDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');
const statePath = join(contentDir, 'review-state.json');
const graveyardDir = join(contentDir, 'graveyard');

interface DecisionEntry {
  decision: 'keep' | 'kill' | 'edit' | 'flag';
  name?: string;
  idea?: string;
  at: string;
}
interface Pitch {
  id: string;
  name: string;
  idea: string;
  sector: string;
}

if (!existsSync(statePath)) {
  console.log('No review-state.json — nothing to apply. Review at ?review=1 first.');
  process.exit(0);
}

const state = JSON.parse(readFileSync(statePath, 'utf8')) as {
  _source?: string;
  decisions?: Record<string, DecisionEntry>;
};
const decisions = state.decisions ?? {};

const pitchDir = join(contentDir, 'pitches');
const files = readdirSync(pitchDir).filter((f) => f.endsWith('.json')).sort();

let killed = 0;
let edited = 0;
const graveyardBySector = new Map<string, Pitch[]>();
const remainingBySector = new Map<string, number>();
const flaggedBySector = new Map<string, number>();
const unreviewedBySector = new Map<string, number>();
const bump = (map: Map<string, number>, key: string): void => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

for (const file of files) {
  const path = join(pitchDir, file);
  const data = JSON.parse(readFileSync(path, 'utf8')) as { _source?: string; pitches: Pitch[] };
  const survivors: Pitch[] = [];
  let changed = false;

  for (const pitch of data.pitches) {
    const entry = decisions[pitch.id];
    if (entry?.decision === 'kill') {
      const pile = graveyardBySector.get(pitch.sector) ?? [];
      pile.push(pitch);
      graveyardBySector.set(pitch.sector, pile);
      killed += 1;
      changed = true;
      delete decisions[pitch.id];
      continue;
    }
    if (entry?.decision === 'edit') {
      pitch.name = entry.name ?? pitch.name;
      pitch.idea = entry.idea ?? pitch.idea;
      edited += 1;
      changed = true;
      delete decisions[pitch.id];
      // An applied edit counts as reviewed-and-kept from here on.
      decisions[pitch.id] = { decision: 'keep', at: new Date().toISOString() };
    }
    if (entry?.decision === 'flag') bump(flaggedBySector, pitch.sector);
    if (!entry) bump(unreviewedBySector, pitch.sector);
    bump(remainingBySector, pitch.sector);
    survivors.push(pitch);
  }

  if (changed) {
    writeFileSync(path, `${JSON.stringify({ ...data, pitches: survivors }, null, 2)}\n`);
  }
}

// Append the fallen to their sector graveyards.
if (graveyardBySector.size > 0) {
  mkdirSync(graveyardDir, { recursive: true });
  for (const [sector, fallen] of graveyardBySector) {
    const gravePath = join(graveyardDir, `${sector.toLowerCase()}.json`);
    const existing: { _source?: string; pitches: Pitch[] } = existsSync(gravePath)
      ? (JSON.parse(readFileSync(gravePath, 'utf8')) as { _source?: string; pitches: Pitch[] })
      : { _source: 'Killed in review. Kept for salvage and regret.', pitches: [] };
    existing.pitches.push(...fallen);
    writeFileSync(gravePath, `${JSON.stringify(existing, null, 2)}\n`);
  }
}

state.decisions = decisions;
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

console.log(`Applied: ${killed} killed -> graveyard, ${edited} edited in place.\n`);
console.log('Pool by sector (remaining · flagged · unreviewed):');
const sectors = [...remainingBySector.keys()].sort();
for (const sector of sectors) {
  const remaining = remainingBySector.get(sector) ?? 0;
  const thin = remaining < 10 ? '   <- THIN, regenerate' : '';
  console.log(
    `  ${sector.padEnd(10)} ${String(remaining).padStart(3)} · ${String(
      flaggedBySector.get(sector) ?? 0,
    ).padStart(2)} flagged · ${String(unreviewedBySector.get(sector) ?? 0).padStart(2)} unreviewed${thin}`,
  );
}
console.log('\nRun npm run validate-content to confirm the pool is still clean.');
