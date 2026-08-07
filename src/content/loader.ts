/**
 * Lazy content loader — the app's entry point to content. Every JSON file is
 * a dynamic import, so Vite code-splits content out of the main bundle and
 * the shell can paint before content arrives. Same validation as the eager
 * loader; the service worker caches the chunks for offline play.
 */

import type { Content } from './types';
import { assembleContent } from './validate';

const pitchModules = import.meta.glob<{ default: unknown }>('./pitches/*.json');

let cached: Content | null = null;

export async function loadContentAsync(): Promise<Content> {
  if (cached) return cached;

  const batchesPromise = Promise.all(
    Object.keys(pitchModules)
      .sort()
      .map(async (path) => {
        const module = await (pitchModules[path] as () => Promise<{ default: unknown }>)();
        return [path, module.default] as const;
      }),
  );
  const [theses, firmNames, lines, batches] = await Promise.all([
    import('./theses.json'),
    import('./firmNames.json'),
    import('./lines.json'),
    batchesPromise,
  ]);

  cached = assembleContent(batches, theses.default, firmNames.default, lines.default);
  return cached;
}
