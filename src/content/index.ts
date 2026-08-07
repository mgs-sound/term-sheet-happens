/**
 * Eager content loader — used by tests and any synchronous consumer. The app
 * itself uses ./loader.ts (lazy, code-split) so content JSON stays out of the
 * main bundle. The manifest is the `import.meta.glob`: dropping a new JSON
 * file into src/content/pitches/ is the ONLY step needed to add pitches.
 */

import thesesJson from './theses.json';
import firmNamesJson from './firmNames.json';
import linesJson from './lines.json';
import type { Content } from './types';
import { assembleContent } from './validate';

const pitchFiles = import.meta.glob<{ default: unknown }>('./pitches/*.json', {
  eager: true,
});

/** Sorted list of discovered pitch files — exposed for tests/debugging. */
export const pitchFileManifest: string[] = Object.keys(pitchFiles).sort();

let cached: Content | null = null;

/** Load and validate all content. Throws with every error listed on failure. */
export function loadContent(): Content {
  if (!cached) {
    cached = assembleContent(
      pitchFileManifest.map((path) => [path, pitchFiles[path]?.default] as const),
      thesesJson,
      firmNamesJson,
      linesJson,
    );
  }
  return cached;
}
