import { describe, expect, it } from 'vitest';
import { pickCarryLine } from './carry';
import { loadContent, pitchFileManifest } from './index';
import { SECTORS, VERDICT_BUCKETS, EXIT_BUCKETS } from './types';

describe('content pool', () => {
  it('loads all content without validation errors', () => {
    expect(() => loadContent()).not.toThrow();
  });

  it('discovers one pitch file per sector via the manifest', () => {
    expect(pitchFileManifest.length).toBeGreaterThanOrEqual(SECTORS.length);
  });

  it('has at least 80 pitches, covering every sector with 8+', () => {
    const { pitches } = loadContent();
    expect(pitches.length).toBeGreaterThanOrEqual(80);
    for (const sector of SECTORS) {
      const count = pitches.filter((p) => p.sector === sector).length;
      expect(count, `sector ${sector}`).toBeGreaterThanOrEqual(8);
    }
  });

  it('has at least 12 theses', () => {
    const { theses } = loadContent();
    expect(theses.length).toBeGreaterThanOrEqual(12);
  });

  it('has non-empty firm name pools', () => {
    const { firmNames } = loadContent();
    expect(firmNames.prefixes.length).toBeGreaterThan(0);
    expect(firmNames.suffixes.length).toBeGreaterThan(0);
  });

  it('has every flavor pool populated', () => {
    const { lines } = loadContent();
    expect(lines.rehireCard.length).toBeGreaterThan(0);
    expect(lines.zombieFundJabs.length).toBeGreaterThan(0);
    expect(lines.vetoLines.length).toBeGreaterThan(0);
    expect(lines.founderWalkLines.length).toBeGreaterThan(0);
    expect(lines.lpOfferQuirks.length).toBeGreaterThan(0);
    expect(lines.vetoHeartbreak.length).toBeGreaterThan(0);
    expect(lines.poachLines.length).toBeGreaterThan(0);
    for (const bucket of VERDICT_BUCKETS) {
      expect(lines.verdicts[bucket].length, `verdicts.${bucket}`).toBeGreaterThan(0);
    }
    for (const bucket of EXIT_BUCKETS) {
      expect(lines.harvestOutcomeLabels[bucket], `label.${bucket}`).toBeTruthy();
    }
    expect(lines.reputationStages).toHaveLength(5);
    expect(lines.founderMoods.length).toBeGreaterThanOrEqual(3);
    expect(lines.boardSeatLocked.length).toBeGreaterThan(0);
    expect(lines.finalCardPitches.length).toBeGreaterThan(0);
    expect(lines.enlightenmentLines.length).toBeGreaterThan(0);
    expect(lines.creditsLines.length).toBeGreaterThan(0);
    for (const bucket of VERDICT_BUCKETS) {
      expect(lines.verdictStamps[bucket], `stamp.${bucket}`).toBeTruthy();
      expect(lines.shareLines[bucket].length, `share.${bucket}`).toBeGreaterThan(0);
    }
    expect(lines.shareCareerLines.length).toBeGreaterThan(0);
    expect(lines.registerUnreachable.length).toBeGreaterThan(0);
  });

  it('carry price ladder covers the full range with a failure pool', () => {
    const { carryEquivalences: eq } = loadContent();
    expect(eq.failure.length).toBeGreaterThanOrEqual(5);
    expect(eq.ladder.length).toBeGreaterThanOrEqual(30);
    expect(eq.ladder.some((e) => e.thresholdM === 0)).toBe(true);
    expect(eq.ladder.some((e) => e.thresholdM >= 500)).toBe(true);
  });

  it('picks the highest rung the carry clears, failure pool at zero', () => {
    const { carryEquivalences: eq } = loadContent();
    expect(eq.failure).toContain(pickCarryLine(eq, 0, 1));
    expect(eq.failure).toContain(pickCarryLine(eq, -1, 2));

    const at2 = pickCarryLine(eq, 2.5, 0);
    const tier2Lines = eq.ladder.filter((e) => e.thresholdM === 2).map((e) => e.line);
    expect(tier2Lines).toContain(at2);

    const at600 = pickCarryLine(eq, 600, 0);
    const topLines = eq.ladder.filter((e) => e.thresholdM === 500).map((e) => e.line);
    expect(topLines).toContain(at600);

    // Tiny positive carry lands on the zero rung, not the failure pool.
    const tiny = pickCarryLine(eq, 0.001, 0);
    expect(eq.ladder.filter((e) => e.thresholdM === 0).map((e) => e.line)).toContain(tiny);
  });

  it('rotates among lines sharing a threshold by key', () => {
    const { carryEquivalences: eq } = loadContent();
    const a = pickCarryLine(eq, 13, 0); // the 12-tier has two entries
    const b = pickCarryLine(eq, 13, 1);
    expect(a).not.toBe(b);
    expect(pickCarryLine(eq, 13, 2)).toBe(a); // deterministic cycle
  });
});
