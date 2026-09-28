import type { Sector } from '../../content/types';

/**
 * Display fonts for the company name on pitch cards (presentation only — no
 * game logic). Each sector has a pool of 3 faces that parody how that kind of
 * startup brands itself. Ids match the [data-font] rules and the
 * 'TSH <id>' @font-face families in cardFonts.css.
 */
export const CARD_FONT_POOLS: Record<Sector, readonly [string, string, string]> = {
  AI: ['space-grotesk', 'sora', 'ibm-plex-mono'],
  SaaS: ['montserrat', 'poppins', 'plus-jakarta-sans'],
  Fintech: ['dm-serif-display', 'playfair-display', 'libre-baskerville'],
  Consumer: ['fredoka', 'baloo-2', 'righteous'],
  Climate: ['fraunces', 'young-serif', 'zilla-slab'],
  Health: ['nunito', 'quicksand', 'figtree'],
  Crypto: ['unbounded', 'chakra-petch', 'oxanium'],
  Gaming: ['press-start-2p', 'silkscreen', 'bungee'],
  Space: ['orbitron', 'audiowide', 'michroma'],
  Food: ['lobster', 'pacifico', 'shrikhand'],
};

export const ALL_CARD_FONTS: readonly string[] = Object.values(CARD_FONT_POOLS).flat();

/** Small stable string hash (FNV-1a) — deterministic, no Math.random. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Picks the name font for a card: one of its sector's 3 faces, chosen by the
 * pitch id (so a company always tends to look the same), but NEVER the same
 * face as the previous card. Pools don't overlap, so only back-to-back cards
 * from the same sector can collide — those step to the next face in the pool.
 */
export function pickCardFont(sector: Sector, pitchId: string, previousFont: string | null): string {
  const pool = CARD_FONT_POOLS[sector];
  const start = hash(pitchId) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const font = pool[(start + i) % pool.length] ?? pool[0];
    if (font !== previousFont) return font;
  }
  return pool[0];
}

/**
 * The name font of every company in a run, keyed by pitchId. Cards are shown
 * strictly in deck order (engine draws deck[0], deck[1], ...), so walking the
 * deck reproduces exactly what each card showed — on the run screen, on the
 * harvest screen, and after a reload — with nothing extra to save.
 */
export function fontsForDeck(deck: readonly { pitchId: string; sector: Sector }[]): Map<string, string> {
  const fonts = new Map<string, string>();
  let previous: string | null = null;
  for (const card of deck) {
    previous = pickCardFont(card.sector, card.pitchId, previous);
    fonts.set(card.pitchId, previous);
  }
  return fonts;
}

/**
 * Font for a portfolio company. The engine ids companies as
 * `${pitchId}@m${meetingIndex}` (engine.ts), so strip the suffix to get the
 * pitch id the card was shown under.
 */
export function fontForCompany(fonts: Map<string, string>, companyId: string): string | undefined {
  const at = companyId.indexOf('@');
  return fonts.get(at === -1 ? companyId : companyId.slice(0, at));
}
