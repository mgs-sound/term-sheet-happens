import { describe, expect, it } from 'vitest';
import { flappyAt, makeFlappyCourse, TRI_H } from './flappy';
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
  it('builds five zigzag triangles, all on stage', () => {
    for (let seed = 1; seed < 60; seed++) {
      const course = makeFlappyCourse(createRng(seed), 0);
      expect(course).toHaveLength(FLAPPY.obstacles);
      course.forEach((o, i) => {
        if (i > 0) expect(o.fromTop).toBe(!course[i - 1]!.fromTop);
        const base = o.fromTop ? o.tip - TRI_H : o.tip + TRI_H;
        expect(base).toBeGreaterThanOrEqual(-1);
        expect(base).toBeLessThanOrEqual(FLAPPY.height + 1);
      });
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
