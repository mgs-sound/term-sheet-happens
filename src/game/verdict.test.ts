import { describe, expect, it } from 'vitest';
import { verdictBucket } from './verdict';

describe('verdict banding', () => {
  it('maps DPI to the five verdict buckets at the tuned thresholds', () => {
    expect(verdictBucket(0)).toBe('wipeout');
    expect(verdictBucket(0.29)).toBe('wipeout');
    expect(verdictBucket(0.3)).toBe('underwater');
    expect(verdictBucket(0.99)).toBe('underwater');
    expect(verdictBucket(1)).toBe('respectable');
    expect(verdictBucket(1.99)).toBe('respectable');
    expect(verdictBucket(2)).toBe('heater');
    expect(verdictBucket(2.99)).toBe('heater');
    expect(verdictBucket(3)).toBe('legend');
    expect(verdictBucket(9)).toBe('legend');
  });
});
