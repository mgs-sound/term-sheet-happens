import { describe, expect, it } from 'vitest';
import { flappyAt, makeFlappyCourse } from './flappy';
import { createRng } from './rng';
import { FLAPPY } from './tuning';
import type { FlappyObstacle } from './types';

/** A decent player: flap when sinking below the next gap's middle. */
function autopilot(course: FlappyObstacle[]): number[] {
  const taps: number[] = [0];
  for (let t = 40; t < FLAPPY.maxMs; t += 40) {
    const s = flappyAt(course, taps, t);
    if (s.crashed || s.finished) break;
    const cx = FLAPPY.craneX + s.scroll;
    const i = course.findIndex((o) => o.x + FLAPPY.triangleWidth / 2 > cx);
    const pair = i < 0 ? [] : course.slice(Math.max(0, i - 1), i + 2);
    const top = Math.max(...pair.filter((o) => o.fromTop).map((o) => o.tip), 0);
    const bottom = Math.min(...pair.filter((o) => !o.fromTop).map((o) => o.tip), FLAPPY.height);
    const mid = (top + bottom) / 2;
    if (s.y > mid + 20 && s.vy > 0) taps.push(t);
  }
  return taps;
}

describe('flappy crane', () => {
  it('builds five zigzag triangles on the bars, of varying lengths', () => {
    for (let seed = 1; seed < 60; seed++) {
      const course = makeFlappyCourse(createRng(seed), 0);
      expect(course).toHaveLength(FLAPPY.obstacles);
      const lengths = course.map((o) => (o.fromTop ? o.tip - FLAPPY.ceilingY : FLAPPY.floorY - o.tip));
      course.forEach((o, i) => {
        if (i > 0) expect(o.fromTop).toBe(!course[i - 1]!.fromTop);
        expect(lengths[i]).toBeGreaterThanOrEqual(FLAPPY.triangleMinHeight - 1);
      });
      expect(new Set(lengths).size).toBeGreaterThan(1);
    }
  });

  it('past the last triangle, dropping onto the floor by the flag is a win', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30 && checked < 5; seed++) {
      const course = makeFlappyCourse(createRng(seed), 0.5);
      const taps = autopilot(course);
      const run = flappyAt(course, taps, FLAPPY.maxMs);
      if (!run.finished) continue;
      // Stop flapping once the last triangle is behind: it falls, and lands home.
      const last = course[course.length - 1]!;
      const clearMs = ((last.x + last.width / 2 + FLAPPY.craneRadius - FLAPPY.craneX) / FLAPPY.scrollSpeed) + 20;
      const lazy = flappyAt(course, taps.filter((t) => t < clearMs), FLAPPY.maxMs);
      expect(lazy.crashed).toBe(false);
      expect(lazy.finished).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('never tapping crashes; a sensible flapper clears the course', () => {
    let cleared = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const course = makeFlappyCourse(createRng(seed), 0.5);
      expect(flappyAt(course, [0], FLAPPY.maxMs).crashed).toBe(true);
      const run = flappyAt(course, autopilot(course), FLAPPY.maxMs);
      if (run.finished) cleared++;
    }
    // Every course is beatable by a simple autopilot (most of the time).
    expect(cleared).toBeGreaterThanOrEqual(24);
  });
});
