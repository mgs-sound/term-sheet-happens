import { useEffect, useRef, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import { craneHits } from '../../game/engine';
import { CRANE } from '../../game/tuning';
import type { CraneFlight } from '../../game/types';
import { services } from '../../services';
import { pickLine } from '../format';
import { ResultStamp } from './ResultStamp';

/** Drawing units (the mockup's panel, ~1720 wide); strokes stay 2px. */
const VIEW = { w: 1720, h: 600 };
/** The ground: cranes are clipped here, so they hide behind the bushes. */
const GROUND = 570;
const POLE_X = 860;
const PIN = { y: 230, r: 48 };
const CRANE_C = { x: 180, y: 120 }; // the crane art's centre (art is 360×240)
/** Positions for a crane leaving the RIGHT bush (centre points); a crane
 *  leaving the left bush uses the mirror image. */
const HIDE = { x: 1380, y: 520 };
const PEEK = { x: 1310, y: 485 };
const LAND = { x: 340, y: 520 };
/** Flight apex (centre y) — right over the pin. */
const APEX_Y = 200;
const PEEK_EASE_MS = 140;

const BUSH_PATH =
  'M75 240A75 75 0 0 1 75 90A100 100 0 0 1 225 25A80 80 0 0 1 370 90A75 75 0 0 1 375 240Z';

function CraneArt(): JSX.Element {
  return (
    <g>
      <path
        className="crane-paper"
        d="M2 45L55 15H82L155 103L288 5L235 110L360 70L265 125L350 240L230 185H170L130 110L80 30Z"
      />
      <path
        className="crane-fold"
        d="M82 15L60 38M155 103L220 83L235 110M130 110L265 122M130 110L230 185"
      />
    </g>
  );
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const mirror = (p: { x: number; y: number }, right: boolean) =>
  right ? p : { x: VIEW.w - p.x, y: p.y };

/** A crane's centre at time `t` (ms since the panel opened). */
function craneAt(c: CraneFlight, t: number): { x: number; y: number } {
  const hide = mirror(HIDE, c.fromRight);
  const land = mirror(LAND, c.fromRight);
  if (t < c.takeoffMs) {
    for (const p of c.peeksMs) {
      if (t >= p && t <= p + CRANE.peekMs) {
        const k = Math.min(1, (t - p) / PEEK_EASE_MS, (p + CRANE.peekMs - t) / PEEK_EASE_MS);
        const peek = mirror(PEEK, c.fromRight);
        return { x: lerp(hide.x, peek.x, k), y: lerp(hide.y, peek.y, k) };
      }
    }
    return hide;
  }
  const u = Math.min(1, (t - c.takeoffMs) / c.flightMs);
  return {
    x: lerp(hide.x, land.x, u),
    // A parabola: apex over the pole at u = 0.5.
    y: lerp(hide.y, land.y, u) - 4 * (hide.y - APEX_Y) * u * (1 - u),
  };
}

/** SVG transform for a crane: placed by its centre, nose leading. */
function craneTransform(c: CraneFlight, t: number): string {
  const p = craneAt(c, t);
  const flip = c.fromRight ? '' : ` translate(${2 * CRANE_C.x} 0) scale(-1 1)`;
  return `translate(${p.x - CRANE_C.x} ${p.y - CRANE_C.y})${flip}`;
}

/**
 * Shoot the cranes: a Partner's final offer below the founder's counter.
 * Three cranes fly in turn, bush to bush across the red pole — a slow warm-up,
 * then two devilishly fast ones. One shot per crane: fire as it crosses.
 * Hit CRANE.hitsToWin of them. The panel only times the shots — the engine
 * decides (RESOLVE_CRANE) by the same rule the score marks use.
 */
export function CraneSheet({
  lines,
  seed,
  cranes: cranesProp,
  windowMs: windowMsProp,
  result,
  stampWon,
  stampLost,
  onDone,
}: {
  lines: FlavorLines;
  seed: number;
  cranes: CraneFlight[];
  windowMs: number;
  /** The engine's verdict once every crane has flown. */
  result: { won: boolean } | null;
  stampWon: string;
  stampLost: string;
  onDone: (shotsMs: (number | null)[]) => void;
}): JSX.Element {
  const copy = lines.crane;
  // The plan is fixed on mount: the engine clears its copy once it settles,
  // while this panel stays up to show how it ended.
  const [{ cranes, windowMs }] = useState(() => ({ cranes: cranesProp, windowMs: windowMsProp }));
  const craneRefs = useRef<(SVGGElement | null)[]>([]);
  const t0 = useRef(performance.now());
  const shots = useRef<(number | null)[]>(cranes.map(() => null));
  const current = useRef(0); // the crane a shot goes to
  // Per crane: null while pending, then hit or missed.
  const [marks, setMarks] = useState<(boolean | null)[]>(cranes.map(() => null));
  const [fired, setFired] = useState(0); // re-keys the pin's kick
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const settleCrane = (i: number): void => {
    const hit = craneHits([cranes[i]!], windowMs, [shots.current[i] ?? null])[0] === true;
    setMarks((m) => m.map((v, j) => (j === i ? hit : v)));
    current.current = i + 1;
    if (current.current >= cranes.length) onDoneRef.current([...shots.current]);
  };

  // The cranes' whole act runs off one clock; a hit crane freezes and drops.
  useEffect(() => {
    let raf = 0;
    const flapped = new Set<number>();
    const last = cranes[cranes.length - 1];
    const lastLanding = last ? last.takeoffMs + last.flightMs : 0;
    const tick = (): void => {
      const t = performance.now() - t0.current;
      cranes.forEach((c, i) => {
        const el = craneRefs.current[i];
        const shot = shots.current[i];
        const frozen = el?.dataset.hit === '1' && shot != null;
        el?.setAttribute('transform', craneTransform(c, frozen ? shot : t));
        if (!flapped.has(i) && t >= c.takeoffMs) {
          flapped.add(i);
          services.audio.play('draft'); // paper wings: fium
        }
      });
      // A crane that has landed (plus grace) unshot counts as a miss.
      const i = current.current;
      const c = cranes[i];
      if (c && t > c.takeoffMs + c.flightMs + CRANE.graceMs) settleCrane(i);
      // Keep flying until the last crane has landed, shot or not.
      if (t < lastLanding + CRANE.graceMs) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shoot = (): void => {
    const i = current.current;
    if (i >= cranes.length || shots.current[i] != null) return;
    const t = performance.now() - t0.current;
    shots.current[i] = t;
    setFired((f) => f + 1);
    services.audio.play('finalOffer'); // bang
    void services.haptics.tap();
    const hit = craneHits([cranes[i]!], windowMs, [t])[0] === true;
    const el = craneRefs.current[i];
    if (hit && el) {
      el.dataset.hit = '1';
      el.querySelector('.crane-body')?.classList.add('crane-hit');
    }
    settleCrane(i);
  };

  const done = current.current >= cranes.length || result !== null;

  return (
    <div className="sheet challenge-sheet crane-sheet" role="dialog" aria-label={copy.title}>
      <div className="challenge-title">{copy.title}</div>
      <p className="challenge-line">
        {result ? pickLine(result.won ? copy.won : copy.lost, seed) : pickLine(copy.intros, seed)}
      </p>

      <div className="crane-stage" aria-hidden="true">
        <svg className="crane-art" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} overflow="visible">
          <defs>
            <clipPath id="crane-ground">
              <rect x="-400" y="-600" width={VIEW.w + 800} height={GROUND + 600} />
            </clipPath>
          </defs>
          {/* The sight: a red pin on a pole. */}
          <line className="crane-pole" x1={POLE_X} y1={PIN.y} x2={POLE_X} y2={GROUND} />
          <circle
            key={fired}
            className={`crane-pin ${fired > 0 ? 'is-fired' : ''}`}
            cx={POLE_X}
            cy={PIN.y}
            r={PIN.r}
          />
          <g clipPath="url(#crane-ground)">
            {cranes.map((c, i) => (
              <g
                key={i}
                ref={(el) => {
                  craneRefs.current[i] = el;
                }}
                transform={craneTransform(c, 0)}
              >
                <g className="crane-body">
                  <CraneArt />
                </g>
              </g>
            ))}
          </g>
          {/* Bushes in front: the cranes hide behind them. */}
          <path className="crane-bush" d={BUSH_PATH} transform="translate(140 330)" />
          <path className="crane-bush" d={BUSH_PATH} transform="translate(1155 330)" />
        </svg>
      </div>

      {/* Score: one box per crane — pending, hit (✓) or missed (✗). */}
      <div className="crane-score" aria-label="Cranes">
        {marks.map((m, i) => (
          <span
            key={i}
            className={`crane-mark ${m === true ? 'is-hit' : m === false ? 'is-miss' : ''}`}
          >
            {m === true ? '✓' : m === false ? '✗' : ''}
          </span>
        ))}
      </div>

      {result && <ResultStamp won={result.won} text={result.won ? stampWon : stampLost} />}

      <div className="challenge-actions crane-actions">
        <button
          type="button"
          className="btn btn-stay crane-btn"
          data-sfx="none"
          disabled={done}
          onPointerDown={(e) => {
            e.preventDefault();
            shoot();
          }}
          onClick={(e) => {
            if (e.detail === 0) shoot();
          }}
        >
          {copy.cta}
        </button>
      </div>
    </div>
  );
}
