import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { closeCareerFund, initialCareer } from './career';
import { fundCarryM } from './carry';
import { forceHarvestResult } from './devtools';
import { createRng } from './rng';
import { careerForTier, simulateRun } from './sim';
import { CARRY } from './tuning';

const content = loadContent();

describe('carry math', () => {
  it('is zero at or below return of capital', () => {
    expect(fundCarryM(8, 10)).toBe(0);
    expect(fundCarryM(10, 10)).toBe(0);
    expect(fundCarryM(0, 10)).toBe(0);
  });

  it('takes CARRY.rate of the profit above the fund size', () => {
    expect(fundCarryM(15, 10)).toBeCloseTo(5 * CARRY.rate, 10);
    expect(fundCarryM(400, 200)).toBeCloseTo(200 * CARRY.rate, 10);
  });

  it('rounds to 0.1M like all engine money', () => {
    expect(fundCarryM(12.34, 10)).toBe(0.5); // 0.468 -> 0.5
  });

  it('every harvested run carries exactly fundCarryM(returned, fund)', () => {
    for (const seed of [3, 33, 333]) {
      const run = simulateRun(careerForTier('partner'), seed, content);
      expect(run.harvest!.carryM).toBe(fundCarryM(run.harvest!.returnedM, run.fundSizeM));
    }
  });

  it('accumulates careerCarryM and stamps each ledger line', () => {
    const run1 = forceHarvestResult(simulateRun(initialCareer(), 7, content), {
      dpi: 2,
      fundSizeM: 10,
    });
    const after1 = closeCareerFund(initialCareer(), run1, createRng(1), content.theses);
    expect(after1.careerCarryM).toBeCloseTo(2, 10); // (20-10)*0.2
    expect(after1.ledger[0]?.carryM).toBeCloseTo(2, 10);

    const run2 = forceHarvestResult(simulateRun(after1, 8, content), {
      dpi: 0.5,
      fundSizeM: 30,
    });
    const after2 = closeCareerFund(after1, run2, createRng(2), content.theses);
    expect(after2.careerCarryM).toBeCloseTo(2, 10); // failed fund adds nothing
    expect(after2.ledger[1]?.carryM).toBe(0);
  });
});
