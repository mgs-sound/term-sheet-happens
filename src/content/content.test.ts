import { describe, expect, it } from 'vitest';
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
  });
});
