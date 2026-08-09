import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { logoSvg } from './logogen';

describe('procedural logos', () => {
  it('is deterministic: same name always yields the same mark', () => {
    expect(logoSvg('Broth Direct', 'Food', 40)).toBe(logoSvg('Broth Direct', 'Food', 40));
    expect(logoSvg('Kessler Analytics', 'Space', 96)).toBe(logoSvg('Kessler Analytics', 'Space', 96));
  });

  it('different names yield different marks', () => {
    expect(logoSvg('Synergly', 'AI', 40)).not.toBe(logoSvg('Punchd', 'AI', 40));
  });

  it('escapes XML so ampersand names survive strict SVG parsing', () => {
    const svg = logoSvg('Bloom & Bitter', 'Food', 40);
    expect(svg).toContain('Bloom &amp; Bitter');
    expect(svg).not.toMatch(/& /); // no raw ampersands anywhere
  });

  it('derives monograms from names', () => {
    expect(logoSvg('Broth Direct', 'Food', 40)).toContain('>BD</text>');
    expect(logoSvg('gm Protocol', 'Crypto', 40)).toContain('>GP</text>');
    expect(logoSvg('Bloom & Bitter', 'Food', 40)).toContain('>BB</text>'); // '&' skipped
  });

  it('overrides pin single aspects without reshuffling the rest', () => {
    const base = logoSvg('Synergly', 'AI', 40);
    const pinned = logoSvg('Synergly', 'AI', 40, { frame: 'seal' });
    expect(pinned).toContain('data-frame="seal"');
    const tintOf = (svg: string): string => svg.match(/data-tint="(\w+)"/)?.[1] ?? '';
    expect(tintOf(pinned)).toBe(tintOf(base)); // tint unchanged by frame pin
    expect(logoSvg('Synergly', 'AI', 40, { monogram: 'ZZ' })).toContain('>ZZ</text>');
  });

  it('stays inside the memo palette for every real pitch', () => {
    const allowed = new Set(['#1C1B17', '#B3382C', '#1E6B4E', '#FDFCF7']);
    for (const pitch of loadContent().pitches) {
      const svg = logoSvg(pitch.name, pitch.sector, 40);
      for (const color of svg.match(/#[0-9A-Fa-f]{6}/g) ?? []) {
        expect(allowed.has(color), `${pitch.name}: ${color}`).toBe(true);
      }
    }
  });

  it('renders every frame in the vocabulary across the pool', () => {
    const frames = new Set(
      loadContent().pitches.map(
        (p) => logoSvg(p.name, p.sector, 40).match(/data-frame="(\w+)"/)?.[1],
      ),
    );
    expect(frames.size).toBe(4);
  });
});
