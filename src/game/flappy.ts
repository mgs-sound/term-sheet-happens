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

/**
 * Five triangles zigzagging top / bottom, all on screen: the top ones hang
 * from the ceiling bar, the bottom ones stand on the floor bar, each as long
 * as its point needs. The corridor between their points is wider the better
 * the offer, and drifts every run — so no two triangles are the same length.
 */
export function makeFlappyCourse(rng: RNG, acceptance: number): FlappyObstacle[] {
  const gap = lerp(FLAPPY.gapAtHopeless, FLAPPY.gapAtCertain, acceptance);
  const lo = FLAPPY.ceilingY + FLAPPY.triangleMinHeight + gap / 2;
  const hi = FLAPPY.floorY - FLAPPY.triangleMinHeight - gap / 2;
  let fromTop = rng.chance(0.5);
  let centre = rng.float(lo, hi);
  let x = FLAPPY.firstObstacleX;
  const obstacles: FlappyObstacle[] = [];
  for (let i = 0; i < FLAPPY.obstacles; i++) {
    centre = rng.float(Math.max(lo, centre - FLAPPY.maxShift), Math.min(hi, centre + FLAPPY.maxShift));
    const tip = fromTop ? centre - gap / 2 : centre + gap / 2;
    const length = fromTop ? tip - FLAPPY.ceilingY : FLAPPY.floorY - tip;
    const width = Math.max(
      FLAPPY.triangleMinWidth,
      Math.min(FLAPPY.triangleWidth, length * FLAPPY.widthPerLength),
    );
    obstacles.push({ x: Math.round(x), fromTop, tip: Math.round(tip), width: Math.round(width) });
    fromTop = !fromTop;
    x += rng.float(FLAPPY.spacingMin, FLAPPY.spacingMax);
  }
  return obstacles;
}

/** The ceiling and floor bars: flying past either is a crash. */
export function flappyBounds(_obstacles?: readonly FlappyObstacle[]): { ceiling: number; floor: number } {
  return { ceiling: FLAPPY.ceilingY, floor: FLAPPY.floorY };
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

/** An obstacle's triangle as [point, base-left, base-right]. */
export function obstacleTriangle(o: FlappyObstacle): [number, number][] {
  const w = o.width / 2;
  const base = o.fromTop ? FLAPPY.ceilingY : FLAPPY.floorY;
  return [
    [o.x, o.tip],
    [o.x - w, base],
    [o.x + w, base],
  ];
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

/** Where the course ends: the crane reaches the flag. */
export function flappyFinishScroll(): number {
  return FLAPPY.flagX - FLAPPY.craneX;
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
  const finish = flappyFinishScroll();
  const { ceiling, floor } = flappyBounds(obstacles);
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
    s.passed = obstacles.filter((o) => o.x + o.width / 2 < cx - r).length;
    const crashed =
      s.y - r < ceiling ||
      s.y + r > floor ||
      obstacles.some(
        (o) => Math.abs(o.x - cx) < FLAPPY.triangleWidth && hits(cx, s.y, r, obstacleTriangle(o)),
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
