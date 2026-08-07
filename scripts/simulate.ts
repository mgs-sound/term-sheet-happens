/**
 * DPI distribution scanner — `npm run simulate [-- --runs N]`.
 *
 * Runs N seeded funds per tier with the naive strategy from src/game/sim.ts
 * and prints DPI distributions, for tuning the constants in tuning.ts.
 * Runs under plain Node with type stripping, so content is loaded via fs
 * (the Vite glob loader is unavailable here).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateFirmNameParts,
  validatePitchBatch,
  validateTheses,
} from '../src/content/validate.ts';
import type { Pitch } from '../src/content/types.ts';
import type { EngineContent } from '../src/game/types.ts';
import { careerForTier, formatSummary, simulateRun, summarizeDpis } from '../src/game/sim.ts';

const contentDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');

function readJson(relPath: string): unknown {
  return JSON.parse(readFileSync(join(contentDir, relPath), 'utf8'));
}

function loadEngineContent(): EngineContent {
  const pitches: Pitch[] = [];
  const files = readdirSync(join(contentDir, 'pitches'))
    .filter((f) => f.endsWith('.json'))
    .sort();
  for (const file of files) {
    const batch = validatePitchBatch(file, readJson(`pitches/${file}`));
    if (batch.errors.length > 0) throw new Error(batch.errors.join('\n'));
    pitches.push(...batch.pitches);
  }
  const { theses, errors: thesisErrors } = validateTheses(readJson('theses.json'));
  if (thesisErrors.length > 0) throw new Error(thesisErrors.join('\n'));
  const { parts: firmNames, errors: firmErrors } = validateFirmNameParts(
    readJson('firmNames.json'),
  );
  if (firmErrors.length > 0) throw new Error(firmErrors.join('\n'));
  return { pitches, theses, firmNames };
}

const runsArgIndex = process.argv.indexOf('--runs');
const runs = runsArgIndex >= 0 ? Number(process.argv[runsArgIndex + 1]) : 500;
if (!Number.isFinite(runs) || runs < 1) {
  console.error('Usage: npm run simulate [-- --runs N]');
  process.exit(1);
}

const content = loadEngineContent();
console.log(`Simulating ${runs} naive-strategy funds per tier...\n`);

for (const tier of ['fundI', 'associate', 'partner', 'gp'] as const) {
  const dpis: number[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    dpis.push(simulateRun(careerForTier(tier), seed, content).harvest!.dpi);
  }
  console.log(formatSummary(tier === 'fundI' ? 'Fund I' : tier, summarizeDpis(dpis)));
}

console.log(
  '\nTarget: Fund I median 0.3–0.8 (asserted in montecarlo.test.ts). ' +
    'Fund II+ rows are for eyeballing while tuning tuning.ts.',
);
