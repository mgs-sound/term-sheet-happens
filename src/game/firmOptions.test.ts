import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { createRun } from './engine';
import { difficultyBand } from './fundTerms';
import { FIRM_OPTION_COUNT, pickFirmOptions } from './firmOptions';
import { initialCareer } from './career';
import { careerForTier } from './sim';

const content = loadContent();

const parts = (name: string) => ({
  prefix: content.firmNames.prefixes.find((p) => name.startsWith(p)),
  suffix: content.firmNames.suffixes.find((s) => name.endsWith(s)),
});

describe('firm options (Reroll the firm)', () => {
  it('Fund I: one Soft, one Standard, one Brutal, in that order', () => {
    for (let base = 1; base <= 60; base++) {
      const seeds = pickFirmOptions(initialCareer(), content, base * 101);
      expect(seeds).toHaveLength(FIRM_OPTION_COUNT);
      const bands = seeds.map((s) => difficultyBand(createRun(initialCareer(), s, content).fundIDifficulty!));
      expect(bands).toEqual([0, 1, 2]);
    }
  });

  it('options never share a name prefix, suffix, or thesis', () => {
    for (const career of [initialCareer(), careerForTier('associate'), careerForTier('partner')]) {
      for (let base = 1; base <= 40; base++) {
        const runs = pickFirmOptions(career, content, base * 977).map((s) => createRun(career, s, content));
        const ps = runs.map((r) => parts(r.firmName));
        expect(new Set(ps.map((p) => p.prefix)).size).toBe(FIRM_OPTION_COUNT);
        expect(new Set(ps.map((p) => p.suffix)).size).toBe(FIRM_OPTION_COUNT);
        expect(new Set(runs.map((r) => r.thesis.id)).size).toBe(FIRM_OPTION_COUNT);
      }
    }
  });

  it('keeps an included (current) seed in the set', () => {
    const seeds = pickFirmOptions(initialCareer(), content, 555, 12345);
    expect(seeds).toContain(12345);
  });
});
