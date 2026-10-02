import { describe, expect, it } from 'vitest';
import { loadContent } from '../content';
import { splitFirmName } from './firm';

const parts = loadContent().firmNames;

describe('splitFirmName', () => {
  it('splits every generated name back into its prefix and suffix', () => {
    for (const p of parts.prefixes) {
      for (const s of parts.suffixes) {
        expect(splitFirmName(`${p} ${s}`, parts)).toEqual([p, s]);
      }
    }
  });

  it('leaves custom names alone', () => {
    expect(splitFirmName('Jaco Capital Management', parts)).toBeNull();
    expect(splitFirmName('Dead Cat', parts)).toBeNull();
  });
});
