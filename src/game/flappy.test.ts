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
    const next = course.find((o) => o.x + FLAPPY.triangleWidth / 2 > cx) ?? course[course.length - 1]!;
    const mid = (next.top + (FLAPPY.height - next.bottom)) / 2;
    if (s.y > mid + 30 && s.vy > 0) taps.push(t);
  }
  return taps;
}

describe('flappy crane', () => {
  it('builds five obstacles, each leaving at least the gap open', () => {
    for (let seed = 1; seed < 60; seed++) {
      const course = makeFlappyCourse(createRng(seed), 0);
      expect(course).toHaveLength(FLAPPY.obstacles);
      for (const o of course) {
        expect(FLAPPY.height - o.top - o.bottom).toBeGreaterThanOrEqual(FLAPPY.gapAtHopeless - 1);
      }
    }
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
