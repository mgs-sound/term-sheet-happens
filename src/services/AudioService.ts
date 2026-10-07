/**
 * AudioService — sound effects behind an interface (standing rule 3), so a
 * native/Capacitor build or a real sound pack can replace the implementation
 * without touching game or UI code.
 *
 * The web implementation is PLACEHOLDER 8-bit SFX synthesized live with the
 * Web Audio API (square / triangle / sawtooth / noise). No audio files, so
 * the game stays 100% offline and the bundle doesn't grow. Every cue is a tiny
 * "score" of notes below — tweak freely; nothing else depends on them.
 */

export type SfxId =
  | 'tap' // generic button
  | 'tick' // checkbox / small toggle
  | 'open' // portfolio / settings open
  | 'close' // portfolio / settings close
  | 'reroll' // card-shuffle riffle
  | 'start' // "take the meetings" — let's go
  | 'pass' // swipe left / pass / walk away
  | 'sign' // swipe right / sign — the stamp
  | 'dealWon' // signing actually closed
  | 'dealFail' // vetoed / founder walked
  | 'denied' // can't do that (e.g. check exceeds dry powder) — short buzz
  | 'interrupt' // a mid-fund interrupt lands (pro rata, bridge, capital call) — desk-phone ring
  | 'draft' // terms sheet pulled out — paper
  | 'counter' // counteroffer lands — sword parry
  | 'meetCounter' // accept the counter's numbers
  | 'finalOffer' // gavel
  | 'fastForward' // VHS fast-forward
  | 'countTick' // score-counter tick while a number counts up
  | 'coinFlip' // partner's coin: thumb flick, spin, landing clink
  | 'cardFlip' // higher/lower: card slid off the deck and turned over
  | 'diceRoll' // even/odd: rattling, slowing tumble, final click
  | 'sticksDraw' // longest stick: the fist opens, sticks slide out
  | 'exitModest' // harvest reveal: acquihire / modest exit
  | 'unicorn' // harvest reveal: the big one
  | 'fanfareGood' // results, DPI >= 1x
  | 'fanfareBad'; // results, DPI < 1x

/** Every cue, in the order the dev soundboard lists them. */
export const SFX_IDS: readonly SfxId[] = [
  'tap', 'tick', 'open', 'close', 'reroll', 'start', 'pass', 'sign', 'dealWon', 'dealFail', 'denied', 'interrupt',
  'draft', 'counter', 'meetCounter', 'finalOffer', 'fastForward', 'countTick', 'coinFlip', 'cardFlip', 'diceRoll', 'sticksDraw', 'exitModest', 'unicorn',
  'fanfareGood', 'fanfareBad',
];

export interface AudioService {
  /** Fire-and-forget. Never throws; silently does nothing when muted/unavailable. */
  play(id: SfxId): void;
  /**
   * Slider detent tick whose pitch follows the thumb: `position` 0 (left,
   * low) .. 1 (right, high). Self-throttled, so call it on every change.
   */
  slide(position: number): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
}

export class NoopAudioService implements AudioService {
  play(): void {}
  slide(): void {}
  isMuted(): boolean {
    return true;
  }
  setMuted(): void {}
}

// ---------------------------------------------------------------------------
// Web Audio synth
// ---------------------------------------------------------------------------

type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

/** One voice: a tone (or noise burst) with an optional pitch slide. */
interface Voice {
  /** Start offset in seconds from the cue start. */
  at: number;
  dur: number;
  wave: Wave;
  /** Start frequency (Hz). For noise: band-pass center. */
  f: number;
  /** End frequency for a slide (Hz). Defaults to `f`. */
  to?: number;
  /** Peak gain 0..1 before the master volume. */
  vol?: number;
  /** Vibrato depth in Hz (sad trombone, VHS wobble). */
  vib?: number;
}

const MASTER_VOLUME = 0.18;
/** Slider tick range: left end → right end, in Hz (three octaves). */
const SLIDE_LOW_HZ = 220;
const SLIDE_HIGH_HZ = 1760;
/** Min ms between slider ticks, so a fast drag chirps instead of buzzing. */
const SLIDE_THROTTLE_MS = 35;
const MUTE_KEY = 'tsh.sfxMuted';

// Note helpers (equal temperament, A4 = 440).
const N = (semisFromA4: number): number => 440 * Math.pow(2, semisFromA4 / 12);
const C5 = N(3);
const E5 = N(7);
const G5 = N(10);
const A5 = N(12);
const C6 = N(15);
const E6 = N(19);
const G6 = N(22);
const G4 = N(-2);
const Fs4 = N(-3);
const F4 = N(-4);
const E4 = N(-5);
const D4 = N(-7);

const CUES: Record<SfxId, Voice[]> = {
  tap: [{ at: 0, dur: 0.045, wave: 'square', f: 880, vol: 0.5 }],
  tick: [{ at: 0, dur: 0.025, wave: 'square', f: 1320, vol: 0.35 }],
  open: [
    { at: 0, dur: 0.05, wave: 'square', f: 660, vol: 0.4 },
    { at: 0.05, dur: 0.06, wave: 'square', f: 990, vol: 0.4 },
  ],
  close: [
    { at: 0, dur: 0.05, wave: 'square', f: 990, vol: 0.4 },
    { at: 0.05, dur: 0.06, wave: 'square', f: 660, vol: 0.4 },
  ],
  // Riffle: rapid clicks of filtered noise, like thumbing through cards.
  reroll: [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    at: i * 0.032,
    dur: 0.022,
    wave: 'noise' as const,
    f: 2600 + i * 250,
    vol: 0.7,
  })),
  // Rising "let's go" arpeggio.
  start: [
    { at: 0, dur: 0.07, wave: 'square', f: C5 },
    { at: 0.07, dur: 0.07, wave: 'square', f: E5 },
    { at: 0.14, dur: 0.07, wave: 'square', f: G5 },
    { at: 0.21, dur: 0.18, wave: 'square', f: C6 },
    { at: 0.21, dur: 0.18, wave: 'triangle', f: C5, vol: 0.6 },
  ],
  // Swipe left: downward swish + low note.
  pass: [
    { at: 0, dur: 0.12, wave: 'noise', f: 1800, to: 500, vol: 0.5 },
    { at: 0.02, dur: 0.1, wave: 'square', f: G4, to: D4, vol: 0.5 },
  ],
  // Swipe right: upward swish + rubber-stamp thunk.
  sign: [
    { at: 0, dur: 0.1, wave: 'noise', f: 600, to: 2200, vol: 0.45 },
    { at: 0.07, dur: 0.07, wave: 'triangle', f: 180, to: 70, vol: 0.9 },
    { at: 0.07, dur: 0.05, wave: 'square', f: C5, to: G5, vol: 0.45 },
  ],
  // Ka-ching.
  dealWon: [
    { at: 0, dur: 0.06, wave: 'square', f: E6, vol: 0.5 },
    { at: 0.06, dur: 0.22, wave: 'square', f: G6, vol: 0.5 },
    { at: 0.06, dur: 0.18, wave: 'noise', f: 7000, vol: 0.25 },
  ],
  // Desk phone: two short rings, each a fast two-note trill. "Pick up, it's
  // about the money."
  interrupt: [
    { at: 0, dur: 0.05, wave: 'square', f: C6, vol: 0.35 },
    { at: 0.05, dur: 0.05, wave: 'square', f: E6, vol: 0.35 },
    { at: 0.1, dur: 0.05, wave: 'square', f: C6, vol: 0.35 },
    { at: 0.15, dur: 0.05, wave: 'square', f: E6, vol: 0.35 },
    { at: 0.32, dur: 0.05, wave: 'square', f: C6, vol: 0.35 },
    { at: 0.37, dur: 0.05, wave: 'square', f: E6, vol: 0.35 },
    { at: 0.42, dur: 0.05, wave: 'square', f: C6, vol: 0.35 },
    { at: 0.47, dur: 0.05, wave: 'square', f: E6, vol: 0.35 },
  ],
  // Wah-wah buzz.
  dealFail: [
    { at: 0, dur: 0.16, wave: 'sawtooth', f: 262, to: 220, vol: 0.5 },
    { at: 0.17, dur: 0.3, wave: 'sawtooth', f: 208, to: 130, vol: 0.5, vib: 6 },
  ],
  // Error buzz: two quick low blips, flat and dry ("nope-nope").
  denied: [
    { at: 0, dur: 0.07, wave: 'square', f: 155, vol: 0.45 },
    { at: 0.1, dur: 0.09, wave: 'square', f: 147, vol: 0.45 },
  ],
  // Paper pulled from a folder: band-passed noise sweep.
  draft: [
    { at: 0, dur: 0.09, wave: 'noise', f: 900, to: 3500, vol: 0.55 },
    { at: 0.1, dur: 0.12, wave: 'noise', f: 3000, to: 1400, vol: 0.4 },
  ],
  // Parry: two metallic clangs (detuned squares + click).
  counter: [
    { at: 0, dur: 0.02, wave: 'noise', f: 6000, vol: 0.6 },
    { at: 0, dur: 0.14, wave: 'square', f: 1760, vol: 0.35 },
    { at: 0, dur: 0.14, wave: 'square', f: 1865, vol: 0.35 },
    { at: 0.13, dur: 0.02, wave: 'noise', f: 6000, vol: 0.6 },
    { at: 0.13, dur: 0.22, wave: 'square', f: 2093, vol: 0.35 },
    { at: 0.13, dur: 0.22, wave: 'square', f: 2217, vol: 0.35 },
  ],
  // Single clang resolving upward: "fine, deal".
  meetCounter: [
    { at: 0, dur: 0.02, wave: 'noise', f: 6000, vol: 0.5 },
    { at: 0, dur: 0.1, wave: 'square', f: 1760, vol: 0.3 },
    { at: 0.1, dur: 0.12, wave: 'square', f: A5, vol: 0.45 },
  ],
  // Gavel: two wooden knocks, the second heavier.
  finalOffer: [
    { at: 0, dur: 0.08, wave: 'triangle', f: 220, to: 90, vol: 0.9 },
    { at: 0, dur: 0.03, wave: 'noise', f: 1200, vol: 0.6 },
    { at: 0.16, dur: 0.14, wave: 'triangle', f: 200, to: 60, vol: 1 },
    { at: 0.16, dur: 0.04, wave: 'noise', f: 900, vol: 0.7 },
  ],
  // VHS fast-forward: wobbly rising whine + tape hiss.
  fastForward: [
    { at: 0, dur: 0.6, wave: 'sawtooth', f: 180, to: 1400, vol: 0.28, vib: 18 },
    { at: 0, dur: 0.6, wave: 'noise', f: 4500, vol: 0.18 },
    { at: 0.6, dur: 0.05, wave: 'square', f: 1400, vol: 0.3 },
  ],
  // Coin: flick, a slowing spin of alternating pings, then the landing clink.
  coinFlip: [
    { at: 0, dur: 0.03, wave: 'noise', f: 5000, vol: 0.5 },
    ...[0.06, 0.15, 0.25, 0.36, 0.48, 0.61, 0.75, 0.9].map((at, i) => ({
      at,
      dur: 0.035,
      wave: 'square' as const,
      f: i % 2 ? 1568 : 1319,
      vol: 0.22,
    })),
    { at: 1.05, dur: 0.03, wave: 'noise', f: 3500, vol: 0.6 },
    { at: 1.05, dur: 0.18, wave: 'triangle', f: 2093, vol: 0.4 },
  ],
  // Card: a slide off the deck, a beat, then the snap of it turning over.
  cardFlip: [
    { at: 0, dur: 0.12, wave: 'noise', f: 2500, to: 900, vol: 0.45 },
    { at: 0.62, dur: 0.05, wave: 'noise', f: 4200, vol: 0.6 },
    { at: 0.62, dur: 0.08, wave: 'square', f: 660, to: 990, vol: 0.3 },
  ],
  // Die: knocks that space out as it decelerates, then a firm landing click.
  diceRoll: [
    ...[0, 0.07, 0.15, 0.24, 0.35, 0.48, 0.64, 0.83, 1.05].map((at, i) => ({
      at,
      dur: 0.03,
      wave: 'noise' as const,
      f: 1800 + (i % 3) * 400,
      vol: 0.55,
    })),
    { at: 1.3, dur: 0.04, wave: 'noise', f: 2400, vol: 0.75 },
    { at: 1.3, dur: 0.07, wave: 'triangle', f: 330, to: 220, vol: 0.6 },
  ],
  // Sticks: a fist opening (soft swish) then two wooden slides out.
  sticksDraw: [
    { at: 0, dur: 0.14, wave: 'noise', f: 900, to: 2200, vol: 0.4 },
    { at: 0.35, dur: 0.3, wave: 'noise', f: 1400, to: 600, vol: 0.4 },
    { at: 0.72, dur: 0.05, wave: 'triangle', f: 440, vol: 0.5 },
  ],
  // Arcade score counter: a short, low-mid "pip" (not shrill).
  countTick: [{ at: 0, dur: 0.03, wave: 'square', f: 392, vol: 0.28 }],
  // Shrug: two flat mid notes.
  exitModest: [
    { at: 0, dur: 0.08, wave: 'square', f: E5, vol: 0.4 },
    { at: 0.09, dur: 0.12, wave: 'square', f: D4 * 2, vol: 0.35 },
  ],
  // The big one: rapid rising sparkle run + held chord.
  unicorn: [
    ...[C5, E5, G5, C6, E6, G6].map((f, i) => ({
      at: i * 0.045,
      dur: 0.06,
      wave: 'square' as const,
      f,
      vol: 0.4,
    })),
    { at: 0.28, dur: 0.5, wave: 'triangle', f: C6, vol: 0.55 },
    { at: 0.28, dur: 0.5, wave: 'square', f: G6, vol: 0.3, vib: 8 },
    { at: 0.28, dur: 0.4, wave: 'noise', f: 8000, vol: 0.2 },
  ],
  // Subtle win fanfare.
  fanfareGood: [
    { at: 0, dur: 0.1, wave: 'square', f: G5, vol: 0.45 },
    { at: 0.1, dur: 0.1, wave: 'square', f: C6, vol: 0.45 },
    { at: 0.2, dur: 0.1, wave: 'square', f: E6, vol: 0.45 },
    { at: 0.32, dur: 0.45, wave: 'square', f: G6, vol: 0.45 },
    { at: 0.32, dur: 0.45, wave: 'triangle', f: C5, vol: 0.6 },
    { at: 0.32, dur: 0.45, wave: 'triangle', f: E5, vol: 0.4 },
  ],
  // Subtle sad trombone, chiptune edition.
  fanfareBad: [
    { at: 0, dur: 0.2, wave: 'square', f: G4, vol: 0.4 },
    { at: 0.22, dur: 0.2, wave: 'square', f: Fs4, vol: 0.4 },
    { at: 0.44, dur: 0.2, wave: 'square', f: F4, vol: 0.4 },
    { at: 0.66, dur: 0.6, wave: 'square', f: E4, vol: 0.4, vib: 5 },
    { at: 0.66, dur: 0.6, wave: 'triangle', f: E4 / 2, vol: 0.5 },
  ],
};

export class WebAudioService implements AudioService {
  private ctx: AudioContext | null = null;
  private lastSlideAt = 0;
  private noise: AudioBuffer | null = null;
  private muted: boolean;

  constructor() {
    let stored = false;
    try {
      stored = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // storage unavailable (private mode): default to sound on
    }
    this.muted = stored;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // non-fatal
    }
  }

  play(id: SfxId): void {
    if (this.muted) return;
    try {
      const ctx = this.context();
      if (!ctx) return;
      // Browsers start contexts suspended until a user gesture; every play()
      // is triggered by one, so resuming here is enough.
      if (ctx.state === 'suspended') void ctx.resume();
      const t0 = ctx.currentTime + 0.005;
      for (const v of CUES[id]) this.voice(ctx, v, t0);
    } catch {
      // Audio must never break the game.
    }
  }

  slide(position: number): void {
    if (this.muted) return;
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    if (now - this.lastSlideAt < SLIDE_THROTTLE_MS) return;
    this.lastSlideAt = now;
    try {
      const ctx = this.context();
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();
      const p = Math.min(1, Math.max(0, position));
      // Exponential mapping so equal slider distance = equal musical interval.
      const f = SLIDE_LOW_HZ * Math.pow(SLIDE_HIGH_HZ / SLIDE_LOW_HZ, p);
      this.voice(ctx, { at: 0, dur: 0.03, wave: 'square', f, vol: 0.3 }, ctx.currentTime + 0.002);
    } catch {
      // Audio must never break the game.
    }
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext | undefined =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Deterministic LCG noise (no Math.random anywhere in the project).
    let x = 0x12345;
    for (let i = 0; i < len; i++) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      data[i] = (x / 0xffffffff) * 2 - 1;
    }
    this.noise = buf;
    return buf;
  }

  private voice(ctx: AudioContext, v: Voice, t0: number): void {
    const start = t0 + v.at;
    const end = start + v.dur;
    const peak = (v.vol ?? 0.5) * MASTER_VOLUME;

    // Short attack / exponential decay envelope — the "chip" feel.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.008, v.dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(ctx.destination);

    let src: AudioScheduledSourceNode;
    if (v.wave === 'noise') {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(v.f, start);
      if (v.to) bp.frequency.exponentialRampToValueAtTime(v.to, end);
      n.connect(bp);
      bp.connect(gain);
      src = n;
    } else {
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(v.f, start);
      if (v.to) osc.frequency.exponentialRampToValueAtTime(v.to, end);
      if (v.vib) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 7;
        depth.gain.value = v.vib;
        lfo.connect(depth);
        depth.connect(osc.frequency);
        lfo.start(start);
        lfo.stop(end);
      }
      osc.connect(gain);
      src = osc;
    }
    src.start(start);
    src.stop(end + 0.02);
  }
}
