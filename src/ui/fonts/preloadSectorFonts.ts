import { ALL_CARD_FONTS } from './cardFonts';

/** Max time boot waits for fonts; after this, cards fall back and swap in. */
const FONT_PRELOAD_TIMEOUT_MS = 1500;

/**
 * Fetches and decodes every pitch-card name font up front (during the boot
 * blank frame), so a card never renders in the fallback serif and then
 * visibly swaps. Family names match the @font-face rules in cardFonts.css
 * ('TSH <id>'). Never throws and never blocks boot longer than the timeout.
 */
export async function preloadSectorFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const loads = ALL_CARD_FONTS.map((id) => document.fonts.load(`1em "TSH ${id}"`).catch(() => []));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_PRELOAD_TIMEOUT_MS));
  await Promise.race([Promise.all(loads), timeout]);
}
