import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { initialCareer } from './career';
import { fundCarryM } from './carry';
import { migrateSave, type SaveData } from './save';
import { simulateRun } from './sim';

const content = loadContent();

function validSave(): SaveData {
  return {
    career: initialCareer(),
    game: simulateRun(initialCareer(), 42, content),
    screen: 'scorecard',
    pendingCareer: null,
    pendingScore: null,
  };
}

describe('save schema migration', () => {
  it('accepts a current (v3) save and round-trips through JSON', () => {
    const save = validSave();
    const revived = migrateSave(3, JSON.parse(JSON.stringify(save)));
    expect(revived).toEqual(save);
  });

  it('accepts a between-runs save with a null game', () => {
    const save: SaveData = { ...validSave(), game: null, screen: 'reveal' };
    expect(migrateSave(3, JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('upgrades a v2 save with register identity defaults', () => {
    const save = JSON.parse(JSON.stringify(validSave())) as Record<string, any>;
    delete save.pendingScore;
    delete save.career.playerName;
    delete save.career.careerId;
    delete save.career.boardOptIn;
    const revived = migrateSave(2, save);
    expect(revived).not.toBeNull();
    expect(revived!.career.playerName).toBeNull();
    expect(revived!.career.careerId).toBeNull();
    expect(revived!.career.boardOptIn).toBeNull();
    expect(revived!.pendingScore).toBeNull();
  });

  it('upgrades a v1 save by backfilling carry from saved figures', () => {
    const save = JSON.parse(JSON.stringify(validSave())) as Record<string, any>;
    // Strip the v2 fields the way a real v1 save would lack them.
    delete save.career.careerCarryM;
    save.career.ledger = [
      { fundIndex: 1, firmName: 'X & Sons', thesisId: 't', tier: 'associate', fundSizeM: 10, returnedM: 25, dpi: 2.5 },
      { fundIndex: 2, firmName: 'Y Capital', thesisId: 't', tier: 'partner', fundSizeM: 90, returnedM: 40, dpi: 0.44 },
    ];
    delete save.game.harvest.carryM;

    const revived = migrateSave(1, save);
    expect(revived).not.toBeNull();
    expect(revived!.career.ledger[0]?.carryM).toBeCloseTo(3, 10); // (25-10)*0.2
    expect(revived!.career.ledger[1]?.carryM).toBe(0); // underwater fund
    expect(revived!.career.careerCarryM).toBeCloseTo(3, 10);
    expect(revived!.game!.harvest!.carryM).toBe(
      fundCarryM(revived!.game!.harvest!.returnedM, revived!.game!.fundSizeM),
    );
  });

  it('rejects unknown schema versions', () => {
    expect(migrateSave(0, validSave())).toBeNull();
    expect(migrateSave(999, validSave())).toBeNull();
  });

  it('rejects corrupt payloads instead of crashing', () => {
    expect(migrateSave(2, null)).toBeNull();
    expect(migrateSave(2, 'garbage')).toBeNull();
    expect(migrateSave(2, {})).toBeNull();
    expect(migrateSave(2, { career: { tier: 'associate' } })).toBeNull();
    const truncated = { ...validSave(), game: { phase: 'meeting' } };
    expect(migrateSave(2, truncated)).toBeNull();
  });
});
