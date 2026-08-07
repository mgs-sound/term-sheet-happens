/**
 * Content validator CLI — `npm run validate-content`.
 *
 * Runs under plain Node via --experimental-strip-types (no build step), so it
 * reads JSON with fs instead of imports and uses explicit .ts extensions.
 * Validation rules live in src/content/validate.ts, shared with the app loader.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pitch } from '../src/content/types.ts';
import {
  validateFirmNameParts,
  validateFlavorLines,
  validatePitchBatch,
  validatePitchPool,
  validateTheses,
} from '../src/content/validate.ts';

const contentDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');

function readJson(relPath: string): unknown {
  return JSON.parse(readFileSync(join(contentDir, relPath), 'utf8'));
}

const errors: string[] = [];
const pitches: Pitch[] = [];
const perFile: string[] = [];

const pitchDir = join(contentDir, 'pitches');
const pitchFiles = readdirSync(pitchDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (pitchFiles.length === 0) {
  errors.push('src/content/pitches/ contains no .json files');
}

for (const file of pitchFiles) {
  const label = `pitches/${file}`;
  try {
    const batch = validatePitchBatch(label, readJson(label));
    errors.push(...batch.errors);
    pitches.push(...batch.pitches);
    perFile.push(`  ${batch.errors.length === 0 ? 'ok ' : 'ERR'} ${label} — ${batch.pitches.length} pitches`);
  } catch (err) {
    errors.push(`${label}: unreadable JSON (${String(err)})`);
    perFile.push(`  ERR ${label} — unreadable`);
  }
}

errors.push(...validatePitchPool(pitches));

const { theses, errors: thesisErrors } = validateTheses(readJson('theses.json'));
errors.push(...thesisErrors);

const { errors: firmErrors } = validateFirmNameParts(readJson('firmNames.json'));
errors.push(...firmErrors);

const { errors: lineErrors } = validateFlavorLines(readJson('lines.json'));
errors.push(...lineErrors);

const bySector = new Map<string, number>();
for (const p of pitches) bySector.set(p.sector, (bySector.get(p.sector) ?? 0) + 1);
const sectorSummary = [...bySector.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([sector, n]) => `${sector} ${n}`)
  .join(', ');

console.log('Pitch files:');
for (const line of perFile) console.log(line);
console.log(`\nTotals: ${pitches.length} pitches (${sectorSummary}); ${theses.length} theses.`);

if (errors.length > 0) {
  console.error(`\nFAIL — ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('\nOK — content is valid.');
