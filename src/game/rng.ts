/**
 * Seeded RNG for all game randomness.
 *
 * Rule: nothing in src/game may call Math.random. Every system that needs
 * randomness receives an injected `RNG` instance so runs are reproducible
 * in tests (same seed -> same fund, same deck, same exits).
 */

export interface RNG {
  /** Uniform float in [0, 1). The primitive all other methods build on. */
  next(): number;
  /** Uniform integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** True with probability `p` (clamped to [0, 1]). */
  chance(p: number): boolean;
  /** Uniform pick from a non-empty array. Throws on empty. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle. Returns a new array; input is not mutated. */
  shuffle<T>(items: readonly T[]): T[];
  /** Independent child stream, so subsystems can't perturb each other's draws. */
  fork(): RNG;
  /**
   * Serializable internal state (a uint32). `createRng(getState())` resumes
   * the stream exactly — this is how the reducer stays pure: GameState stores
   * the rng state and every action re-creates the stream from it.
   */
  getState(): number;
}

/**
 * mulberry32 — small, fast, good-enough 32-bit PRNG for game logic.
 * `seed` may be a fresh seed or a previously captured `getState()` value;
 * both are just the uint32 internal state.
 */
export function createRng(seed: number): RNG {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: RNG = {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < Math.min(1, Math.max(0, p));
    },
    pick(items) {
      if (items.length === 0) {
        throw new Error('RNG.pick called with an empty array');
      }
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i] as (typeof out)[number];
        out[i] = out[j] as (typeof out)[number];
        out[j] = tmp;
      }
      return out;
    },
    fork() {
      // Derive the child seed from this stream so forks are deterministic too.
      return createRng(Math.floor(next() * 4294967296));
    },
    getState() {
      return state;
    },
  };
  return rng;
}

/**
 * Hash an arbitrary string into a 32-bit seed (xmur3 finalizer).
 * Used to seed a run from e.g. a firm name or a share code.
 */
export function seedFromString(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
