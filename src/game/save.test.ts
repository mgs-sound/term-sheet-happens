import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { initialCareer } from './career';
import { migrateSave, type SaveData } from './save';
import { simulateRun } from './sim';

const content = loadContent();

function validSave(): SaveData {
  return {
    career: initialCareer(),
    game: simulateRun(initialCareer(), 42, content),
    screen: 'scorecard',
    pendingCareer: null,
  };
}

describe('save schema migration', () => {
  it('accepts a current (v1) save and round-trips through JSON', () => {
    const save = validSave();
    const revived = migrateSave(1, JSON.parse(JSON.stringify(save)));
    expect(revived).toEqual(save);
  });

  it('accepts a between-runs save with a null game', () => {
    const save: SaveData = { ...validSave(), game: null, screen: 'reveal' };
    expect(migrateSave(1, JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('rejects unknown schema versions', () => {
    expect(migrateSave(0, validSave())).toBeNull();
    expect(migrateSave(999, validSave())).toBeNull();
  });

  it('rejects corrupt payloads instead of crashing', () => {
    expect(migrateSave(1, null)).toBeNull();
    expect(migrateSave(1, 'garbage')).toBeNull();
    expect(migrateSave(1, {})).toBeNull();
    expect(migrateSave(1, { career: { tier: 'associate' } })).toBeNull();
    const truncated = { ...validSave(), game: { phase: 'meeting' } };
    expect(migrateSave(1, truncated)).toBeNull();
  });
});
