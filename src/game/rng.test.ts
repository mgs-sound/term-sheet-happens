import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from './rng';

describe('createRng (mulberry32)', () => {
  it('is deterministic: same seed produces the same sequence', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() stays in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() stays inclusive of both bounds', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(1, 5);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('shuffle() is a deterministic permutation and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = createRng(42).shuffle(input);
    const b = createRng(42).shuffle(input);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('fork() yields independent deterministic child streams', () => {
    const a = createRng(2024).fork();
    const b = createRng(2024).fork();
    expect(a.next()).toBe(b.next());
  });

  it('seedFromString is stable', () => {
    expect(seedFromString('Adverse Selection & Sons')).toBe(
      seedFromString('Adverse Selection & Sons'),
    );
    expect(seedFromString('Fund I')).not.toBe(seedFromString('Fund II'));
  });
});
