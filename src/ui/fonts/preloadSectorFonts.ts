import { SECTORS } from '../../content/types';

/** Max time boot waits for fonts; after this, cards fall back and swap in. */
const FONT_PRELOAD_TIMEOUT_MS = 1500;

/**
 * Fetches and decodes every sector display font up front (during the boot
 * blank frame), so a pitch card never renders in the fallback serif and then
 * visibly swaps. Family names must match the @font-face rules in
 * sectorFonts.css ('TSH <Sector>'). Never throws and never blocks boot for
 * longer than the timeout.
 */
export async function preloadSectorFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const loads = SECTORS.map((s) => document.fonts.load(`1em "TSH ${s}"`).catch(() => []));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_PRELOAD_TIMEOUT_MS));
  await Promise.race([Promise.all(loads), timeout]);
}
