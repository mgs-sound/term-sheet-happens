/**
 * Register-name hygiene, shared verbatim by the client (instant feedback)
 * and the API (enforcement). The blocklist is injected so every runtime —
 * Vite, Vercel's bundler, plain Node — loads the JSON its own way.
 */

/** Common lookalike substitutions collapsed before moderation checks. */
const LOOKALIKES: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  $: 's',
  '7': 't',
  '+': 't',
  '8': 'b',
  '9': 'g',
};

/** Trim and collapse internal whitespace runs — the stored/displayed form. */
export function collapseName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Lowercase, map lookalikes, strip everything non-alphanumeric. */
export function normalizeForModeration(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => LOOKALIKES[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

export interface NameFilter {
  /** The display form (collapsed) if acceptable, else null. */
  clean(raw: string, minLen: number, maxLen: number): string | null;
}

export function createNameFilter(blocklist: readonly string[]): NameFilter {
  const normalizedBlocklist = blocklist.map((term) => normalizeForModeration(term)).filter(Boolean);
  return {
    clean(raw, minLen, maxLen) {
      if (typeof raw !== 'string') return null;
      const collapsed = collapseName(raw);
      if (collapsed.length < minLen || collapsed.length > maxLen) return null;
      const normalized = normalizeForModeration(collapsed);
      if (normalizedBlocklist.some((term) => normalized.includes(term))) return null;
      return collapsed;
    },
  };
}
