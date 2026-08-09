/**
 * Procedural letterpress marks: a deterministic SVG logo from a company
 * name (seeded by name hash — same name, same mark, forever). Pure string
 * building, no DOM. Palette and hard edges match the memo aesthetic;
 * per-company pins live in src/content/logo-overrides.json and are passed
 * in by the caller so this module stays content-free.
 */

import type { Sector } from '../content/types.ts';
import { createRng, seedFromString } from './rng.ts';

export type LogoFrame = 'seal' | 'plate' | 'diamond' | 'slab';
export type LogoMotif = 'bars' | 'orbit' | 'wedge' | 'none';
export type LogoTint = 'ink' | 'red' | 'green';

export interface LogoOverride {
  frame?: LogoFrame;
  motif?: LogoMotif;
  tint?: LogoTint;
  monogram?: string;
}

const COLORS: Record<LogoTint, string> = {
  ink: '#1C1B17',
  red: '#B3382C',
  green: '#1E6B4E',
};
const PAPER = '#FDFCF7';

const FRAMES: LogoFrame[] = ['seal', 'plate', 'diamond', 'slab'];

/** Sector accent + motif vocabulary; tints never leave the palette. */
const SECTOR_STYLE: Record<Sector, { tint: LogoTint; motif: LogoMotif }> = {
  AI: { tint: 'green', motif: 'orbit' },
  SaaS: { tint: 'ink', motif: 'bars' },
  Fintech: { tint: 'green', motif: 'bars' },
  Consumer: { tint: 'red', motif: 'bars' },
  Climate: { tint: 'green', motif: 'wedge' },
  Health: { tint: 'red', motif: 'orbit' },
  Crypto: { tint: 'red', motif: 'orbit' },
  Gaming: { tint: 'red', motif: 'wedge' },
  Space: { tint: 'green', motif: 'orbit' },
  Food: { tint: 'red', motif: 'wedge' },
};

/** SVG is XML: raw & / < / " in names ("Bloom & Bitter") must be escaped. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function defaultMonogram(name: string, wantTwo: boolean): string {
  const words = name.split(/\s+/).filter((w) => /^[a-z0-9]/i.test(w));
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? 'X'}${words[1]?.[0] ?? ''}`.toUpperCase();
  }
  const solo = words[0] ?? name;
  return solo.slice(0, wantTwo && solo.length > 1 ? 2 : 1).toUpperCase();
}

/**
 * Deterministic mark for a company. All random draws happen in fixed order
 * BEFORE overrides apply, so pinning one aspect never reshuffles the rest.
 */
export function logoSvg(
  name: string,
  sector: Sector | null,
  sizePx: number,
  override?: LogoOverride,
): string {
  const rng = createRng(seedFromString(name));
  const style = sector ? SECTOR_STYLE[sector] : { tint: 'ink' as LogoTint, motif: 'none' as LogoMotif };

  // Fixed draw order — see docstring.
  const drawnFrame = rng.pick(FRAMES);
  const drawnTinted = rng.chance(0.55);
  const drawnTwoChars = rng.chance(0.65);
  const drawnWantsMotif = rng.chance(0.4);

  const frame = override?.frame ?? drawnFrame;
  const tint = override?.tint ?? (drawnTinted ? style.tint : 'ink');
  const monogram = (override?.monogram ?? defaultMonogram(name, drawnTwoChars))
    .toUpperCase()
    .slice(0, 2);
  // Motifs stay legible only on open frames; seals/diamonds go without.
  const motifAllowed = frame === 'plate' || frame === 'slab';
  const motif =
    override?.motif ??
    (drawnWantsMotif && motifAllowed && style.motif !== 'none' ? style.motif : 'none');

  const C = COLORS[tint];
  const parts: string[] = [];

  if (frame === 'seal') {
    parts.push(`<circle cx="24" cy="24" r="21" fill="none" stroke="${C}" stroke-width="2.5"/>`);
    parts.push(`<circle cx="24" cy="24" r="17" fill="none" stroke="${C}" stroke-width="1"/>`);
  } else if (frame === 'plate') {
    parts.push(`<rect x="5" y="5" width="38" height="38" fill="${C}"/>`);
  } else if (frame === 'diamond') {
    parts.push(
      `<rect x="10.5" y="10.5" width="27" height="27" fill="none" stroke="${C}" stroke-width="2.5" transform="rotate(45 24 24)"/>`,
    );
  } else {
    parts.push(`<rect x="10" y="35" width="28" height="3.5" fill="${C}"/>`);
  }

  const motifColor = frame === 'plate' ? PAPER : C;
  if (motif === 'bars') {
    parts.push(
      `<rect x="31" y="9" width="2.5" height="7" fill="${motifColor}"/>` +
        `<rect x="35" y="11" width="2.5" height="5" fill="${motifColor}"/>` +
        `<rect x="39" y="8" width="2.5" height="8" fill="${motifColor}"/>`,
    );
  } else if (motif === 'orbit') {
    parts.push(
      `<circle cx="37" cy="12" r="4.5" fill="none" stroke="${motifColor}" stroke-width="1"/>` +
        `<circle cx="37" cy="12" r="1.8" fill="${motifColor}"/>`,
    );
  } else if (motif === 'wedge') {
    parts.push(`<polygon points="40,15 40,7 32,15" fill="${motifColor}"/>`);
  }

  const textFill = frame === 'plate' ? PAPER : C;
  const one = monogram.length === 1;
  const fontSize = frame === 'slab' ? (one ? 26 : 20) : one ? 22 : 16;
  const textY = frame === 'slab' ? 31 : 25;
  parts.push(
    `<text x="24" y="${textY}" text-anchor="middle" dominant-baseline="middle" ` +
      `font-family="Georgia, 'Times New Roman', serif" font-weight="700" ` +
      `font-size="${fontSize}" letter-spacing="0.5" fill="${textFill}">${escapeXml(monogram)}</text>`,
  );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${sizePx}" height="${sizePx}" ` +
    `data-frame="${frame}" data-motif="${motif}" data-tint="${tint}" role="img" aria-label="${escapeXml(name)} mark">` +
    parts.join('') +
    `</svg>`
  );
}
