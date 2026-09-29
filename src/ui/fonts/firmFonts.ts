/**
 * Display faces for VC firm names — classic "old money" serifs, because every
 * fund founded last Tuesday dresses like a 19th-century law firm.
 * Presentation only. Ids match [data-firm-font] rules + 'TSH firm <id>'
 * @font-face families in firmFonts.css.
 */
export const FIRM_FONTS = [
  'cinzel',
  'cormorant-garamond',
  'eb-garamond',
  'libre-caslon-text',
  'bodoni-moda',
  'old-standard-tt',
  'prata',
  'marcellus',
] as const;

export type FirmFont = (typeof FIRM_FONTS)[number];

/**
 * The face for a firm, derived from its name alone (FNV-1a hash) — so the
 * same firm looks identical on the engagement letter, the ledger bar, the
 * harvest/scorecard, and in the Career Ledger years later, with nothing saved.
 */
export function firmFont(firmName: string): FirmFont {
  let h = 0x811c9dc5;
  for (let i = 0; i < firmName.length; i++) {
    h ^= firmName.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return FIRM_FONTS[(h >>> 0) % FIRM_FONTS.length] ?? FIRM_FONTS[0];
}
