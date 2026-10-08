/**
 * Flappy crane (Partner+ final offer): the deal, an origami crane, flaps
 * through five green triangles. Pure physics, so the UI draws exactly what the
 * engine will judge: both run `flappyAt` on the same tap times.
 *
 * World units: the stage is FLAPPY.width × FLAPPY.height (y down). Time is ms
 * since the first tap (the first tap also starts the run with a flap).
 */

import type { RNG } from './rng.ts';
import type { FlappyObstacle } from './types.ts';
import { FLAPPY } from './tuning.ts';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t));

/** Five obstacles, different every run; gaps are wider the better the offer. */
export function makeFlappyCourse(rng: RNG, acceptance: number): FlappyObstacle[] {
  const gap = lerp(FLAPPY.gapAtHopeless, FLAPPY.gapAtCertain, acceptance);
  const H = FLAPPY.height;
  const obstacles: FlappyObstacle[] = [];
  let x = FLAPPY.firstObstacleX;
  for (let i = 0; i < FLAPPY.obstacles; i++) {
    const kind = rng.pick(['top', 'bottom', 'both'] as const);
    let top = 0;
    let bottom = 0;
    if (kind === 'both') {
      const centre = rng.float(gap / 2 + FLAPPY.edgeMargin, H - gap / 2 - FLAPPY.edgeMargin);
      top = centre - gap / 2;
      bottom = H - (centre + gap / 2);
    } else {
      const h = rng.float(H * FLAPPY.singleMinShare, H - gap);
      if (kind === 'top') top = h;
      else bottom = h;
    }
    obstacles.push({ x: Math.round(x), top: Math.round(top), bottom: Math.round(bottom) });
    x += rng.float(FLAPPY.spacingMin, FLAPPY.spacingMax);
  }
  return obstacles;
}

export interface FlappyState {
  /** Crane centre height (world units, y down) and vertical speed. */
  y: number;
  vy: number;
  /** How far the course has scrolled (world units). */
  scroll: number;
  /** Obstacles fully behind the crane. */
  passed: number;
  crashed: boolean;
  finished: boolean;
  /** When it crashed / finished (ms), else null. */
  endMs: number | null;
}

/** Triangles of an obstacle, as [apex, base-left, base-right] points. */
export function obstacleTriangles(
  o: FlappyObstacle,
): [number, number][][] {
  const w = FLAPPY.triangleWidth / 2;
  const tris: [number, number][][] = [];
  if (o.top > 0) tris.push([[o.x, o.top], [o.x - w, 0], [o.x + w, 0]]);
  if (o.bottom > 0) {
    const H = FLAPPY.height;
    tris.push([[o.x, H - o.bottom], [o.x - w, H], [o.x + w, H]]);
  }
  return tris;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inTriangle(px: number, py: number, t: [number, number][]): boolean {
  const [a, b, c] = t as [[number, number], [number, number], [number, number]];
  const s = (p1: [number, number], p2: [number, number]) =>
    (px - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (py - p2[1]);
  const d1 = s(a, b);
  const d2 = s(b, c);
  const d3 = s(c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function hits(px: number, py: number, r: number, tri: [number, number][]): boolean {
  if (inTriangle(px, py, tri)) return true;
  for (let i = 0; i < 3; i++) {
    const a = tri[i]!;
    const b = tri[(i + 1) % 3]!;
    if (distToSegment(px, py, a[0], a[1], b[0], b[1]) <= r) return true;
  }
  return false;
}

/** Where the course ends: the crane is clear of the last triangle. */
export function flappyFinishScroll(obstacles: readonly FlappyObstacle[]): number {
  const last = obstacles[obstacles.length - 1];
  const lastX = last ? last.x : 0;
  return lastX + FLAPPY.triangleWidth / 2 + FLAPPY.craneRadius + FLAPPY.finishMargin - FLAPPY.craneX;
}

/**
 * The run at `untilMs`, given every tap (ms since the first tap, ascending;
 * the first tap is at 0). Fixed steps, so it's deterministic.
 */
export function flappyAt(
  obstacles: readonly FlappyObstacle[],
  tapsMs: readonly number[],
  untilMs: number,
): FlappyState {
  const s: FlappyState = {
    y: FLAPPY.height / 2,
    vy: 0,
    scroll: 0,
    passed: 0,
    crashed: false,
    finished: false,
    endMs: null,
  };
  const finish = flappyFinishScroll(obstacles);
  const end = Math.min(untilMs, FLAPPY.maxMs);
  let tap = 0;
  for (let t = 0; t <= end; t += FLAPPY.stepMs) {
    while (tap < tapsMs.length && tapsMs[tap]! <= t) {
      s.vy = -FLAPPY.flapSpeed;
      tap++;
    }
    s.vy = Math.min(FLAPPY.maxFall, s.vy + FLAPPY.gravity * FLAPPY.stepMs);
    s.y += s.vy * FLAPPY.stepMs;
    s.scroll = FLAPPY.scrollSpeed * t;
    const cx = FLAPPY.craneX + s.scroll;
    const r = FLAPPY.craneRadius;
    s.passed = obstacles.filter((o) => o.x + FLAPPY.triangleWidth / 2 < cx - r).length;
    const crashed =
      s.y - r < 0 ||
      s.y + r > FLAPPY.height ||
      obstacles.some(
        (o) => Math.abs(o.x - cx) < FLAPPY.triangleWidth && obstacleTriangles(o).some((tri) => hits(cx, s.y, r, tri)),
      );
    if (crashed) {
      s.crashed = true;
      s.endMs = t;
      return s;
    }
    if (s.scroll >= finish) {
      s.finished = true;
      s.endMs = t;
      return s;
    }
  }
  // Out of time without finishing (it can't stall, but be safe).
  if (end >= FLAPPY.maxMs) {
    s.crashed = true;
    s.endMs = FLAPPY.maxMs;
  }
  return s;
}
