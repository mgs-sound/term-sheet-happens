import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { createRng } from './rng';
import { closeCareerFund } from './career';
import { careerAtEnlightenmentGate, forceHarvestResult } from './devtools';
import { simulateRun } from './sim';

const content = loadContent();

describe('devtools', () => {
  it('a forced enlightenment-grade harvest actually enlightens', () => {
    const gate = careerAtEnlightenmentGate();
    const run = simulateRun(gate, 77, content);
    const forced = forceHarvestResult(run, { dpi: 3.4, fundSizeM: 260, reputation: 92 });
    const after = closeCareerFund(gate, forced, createRng(1), content.theses);
    expect(after.enlightened).toBe(true);
    expect(after.endlessUnlocked).toBe(true);
    expect(after.ledger.at(-1)?.dpi).toBe(3.4);
  });

  it('rejects non-harvested states', () => {
    const gate = careerAtEnlightenmentGate();
    expect(() =>
      forceHarvestResult({ ...simulateRun(gate, 1, content), phase: 'meeting' }, { dpi: 1 }),
    ).toThrow(/not harvested/);
  });
});
