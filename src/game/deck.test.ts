import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { createRng } from './rng';
import { buildDeck } from './deck';
import { createRun } from './engine';
import { initialCareer } from './career';
import { DECK, FUND_I } from './tuning';

const content = loadContent();
const thesis = content.theses[0]!;

describe('deck building', () => {
  it('is deterministic per seed', () => {
    const a = buildDeck(createRng(777), content.pitches, thesis, { count: 40, fundI: false });
    const b = buildDeck(createRng(777), content.pitches, thesis, { count: 40, fundI: false });
    expect(a).toEqual(b);
  });

  it('differs across seeds', () => {
    const a = buildDeck(createRng(1), content.pitches, thesis, { count: 40, fundI: false });
    const b = buildDeck(createRng(2), content.pitches, thesis, { count: 40, fundI: false });
    expect(a).not.toEqual(b);
  });

  it('full runs are deterministic given (seed, career)', () => {
    const a = createRun(initialCareer(), 42, content);
    const b = createRun(initialCareer(), 42, content);
    expect(a).toEqual(b);
  });

  it('hits the on/off thesis ratio exactly at deck level', () => {
    const deck = buildDeck(createRng(5), content.pitches, thesis, { count: 40, fundI: false });
    const on = deck.filter((c) => c.onThesis).length;
    expect(on).toBe(Math.round(40 * DECK.onThesisRatio));
    for (const card of deck) {
      expect(card.onThesis).toBe(thesis.sectors.includes(card.sector));
    }
  });

  it('stacks Fund I decks: quality capped and shifted down', () => {
    const fundI = buildDeck(createRng(9), content.pitches, thesis, { count: 200, fundI: true });
    const fundII = buildDeck(createRng(9), content.pitches, thesis, { count: 200, fundI: false });
    for (const card of fundI) {
      expect(card.quality).toBeLessThanOrEqual(FUND_I.qualityCap);
    }
    const mean = (cards: typeof fundI): number =>
      cards.reduce((sum, c) => sum + c.quality, 0) / cards.length;
    expect(mean(fundI)).toBeLessThan(mean(fundII));
  });

  it('keeps stats and quality within bounds', () => {
    const deck = buildDeck(createRng(11), content.pitches, thesis, { count: 100, fundI: false });
    for (const card of deck) {
      for (const stat of [card.team, card.traction, card.heat]) {
        expect(stat).toBeGreaterThanOrEqual(1);
        expect(stat).toBeLessThanOrEqual(5);
      }
      expect(card.quality).toBeGreaterThanOrEqual(0);
      expect(card.quality).toBeLessThanOrEqual(1);
      expect(card.askM).toBeGreaterThan(0);
      expect(card.valuationM).toBeGreaterThan(0);
    }
  });
});
