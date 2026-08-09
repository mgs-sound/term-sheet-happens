/** Presentation-only formatting helpers. No game math lives here. */

/** $8.4M / $120K style money labels from a millions figure. */
export function fmtM(millions: number): string {
  if (millions === 0) return '$0';
  if (Math.abs(millions) >= 1000) return `$${(millions / 1000).toFixed(1)}B`;
  if (Math.abs(millions) < 1) return `$${Math.round(millions * 1000)}K`;
  return `$${millions.toFixed(1)}M`;
}

export function fmtArrK(arrK: number): string {
  if (arrK <= 0) return 'pre-revenue';
  if (arrK >= 1000) return `$${(arrK / 1000).toFixed(1)}M ARR`;
  return `$${arrK}K ARR`;
}

export function fmtDpi(dpi: number): string {
  return `${dpi.toFixed(2)}x`;
}

/**
 * Deterministic pick from a flavor pool — presentational variety without
 * Math.random. Key with something stable (seed, meeting index, event index).
 */
export function pickLine(pool: readonly string[], key: number): string {
  if (pool.length === 0) return '';
  return pool[Math.abs(Math.trunc(key)) % pool.length] as string;
}

/** Fill {company}-style tokens in a content line. */
export function fillLine(line: string, vars: Record<string, string>): string {
  return line.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}

export const STAGE_LABELS: Record<string, string> = {
  preSeed: 'PRE-SEED',
  seed: 'SEED',
  seriesA: 'SERIES A',
  seriesB: 'SERIES B',
};
