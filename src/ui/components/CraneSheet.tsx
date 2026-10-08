import { useEffect, useRef, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import { CRANE } from '../../game/tuning';
import { services } from '../../services';
import { pickLine } from '../format';
import { ResultStamp } from './ResultStamp';

/** Drawing units (the mockup's panel, ~1720 wide); strokes stay 2px. */
const VIEW = { w: 1720, h: 600 };
/** The ground: the crane is clipped here, so it hides behind the bushes. */
const GROUND = 570;
const POLE_X = 860;
const PIN = { y: 230, r: 48 };
const CRANE_C = { x: 180, y: 120 }; // the crane art's centre (art is 360×240)
/** Where the crane sits: hiding, peeking, and its flight (centre points). */
const HIDE = { x: 1380, y: 520 };
const PEEK = { x: 1310, y: 485 };
const LAND = { x: 340, y: 520 };
/** Flight apex (centre y) — right over the pin. */
const APEX_Y = 200;
const PEEK_MS = 520;
const PEEK_EASE_MS = 140;

const BUSH_PATH =
  'M75 240A75 75 0 0 1 75 90A100 100 0 0 1 225 25A80 80 0 0 1 370 90A75 75 0 0 1 375 240Z';

function Crane(): JSX.Element {
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

/** The crane's centre at time `t` (ms since the panel opened). */
function craneAt(t: number, takeoffMs: number, peeksMs: number[]): { x: number; y: number } {
  if (t < takeoffMs) {
    for (const p of peeksMs) {
      if (t >= p && t <= p + PEEK_MS) {
        const k = Math.min(1, (t - p) / PEEK_EASE_MS, (p + PEEK_MS - t) / PEEK_EASE_MS);
        return { x: lerp(HIDE.x, PEEK.x, k), y: lerp(HIDE.y, PEEK.y, k) };
      }
    }
    return HIDE;
  }
  const u = Math.min(1, (t - takeoffMs) / CRANE.flightMs);
  return {
    x: lerp(HIDE.x, LAND.x, u),
    // A parabola: apex over the pole at u = 0.5.
    y: lerp(HIDE.y, LAND.y, u) - 4 * (HIDE.y - APEX_Y) * u * (1 - u),
  };
}

/**
 * Shoot the crane: a Partner's final offer below the founder's counter. The
 * deal (an origami crane) hides in the right bush, peeks out, then flies fast
 * in a parabola to the left bush across the red pole. One shot: fire as it
 * crosses. The panel only times the shot — the engine decides (RESOLVE_CRANE).
 */
export function CraneSheet({
  lines,
  seed,
  takeoffMs,
  peeksMs,
  result,
  stampWon,
  stampLost,
  onShoot,
}: {
  lines: FlavorLines;
  seed: number;
  takeoffMs: number;
  peeksMs: number[];
  /** The engine's verdict once fired (or given up). */
  result: { won: boolean; shotMs: number | null } | null;
  stampWon: string;
  stampLost: string;
  onShoot: (shotMs: number | null) => void;
}): JSX.Element {
  const copy = lines.crane;
  const craneRef = useRef<SVGGElement>(null);
  const t0 = useRef(performance.now());
  const fired = useRef(false);
  const [shot, setShot] = useState(false);
  const onShootRef = useRef(onShoot);
  onShootRef.current = onShoot;
  const won = result?.won === true;

  const place = (t: number): void => {
    const c = craneAt(t, takeoffMs, peeksMs);
    craneRef.current?.setAttribute(
      'transform',
      `translate(${c.x - CRANE_C.x} ${c.y - CRANE_C.y})`,
    );
  };

  // The crane's whole act runs off the clock; a hit freezes it where it was.
  useEffect(() => {
    if (won) return;
    let raf = 0;
    let flapped = false;
    const tick = (): void => {
      const t = performance.now() - t0.current;
      place(t);
      if (!flapped && t >= takeoffMs) {
        flapped = true;
        services.audio.play('draft'); // paper wings: fium
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const giveUp = window.setTimeout(() => {
      if (fired.current) return;
      fired.current = true;
      onShootRef.current(null);
    }, takeoffMs + CRANE.flightMs + CRANE.graceMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(giveUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, takeoffMs]);

  // Hit: pin it where the shot caught it (then the CSS drop plays).
  useEffect(() => {
    if (won && result?.shotMs != null) place(result.shotMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const shoot = (): void => {
    if (fired.current) return;
    fired.current = true;
    setShot(true);
    services.audio.play('finalOffer'); // bang
    void services.haptics.tap();
    onShootRef.current(performance.now() - t0.current);
  };

  return (
    <div className="sheet challenge-sheet crane-sheet" role="dialog" aria-label={copy.title}>
      <div className="challenge-title">{copy.title}</div>
      <p className="challenge-line">
        {result ? pickLine(won ? copy.won : copy.lost, seed) : pickLine(copy.intros, seed)}
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
          <circle className={`crane-pin ${shot ? 'is-fired' : ''}`} cx={POLE_X} cy={PIN.y} r={PIN.r} />
          <g clipPath="url(#crane-ground)">
            <g ref={craneRef} transform={`translate(${HIDE.x - CRANE_C.x} ${HIDE.y - CRANE_C.y})`}>
              <g className={won ? 'crane-hit' : ''}>
                <Crane />
              </g>
            </g>
          </g>
          {/* Bushes in front: the crane hides behind them. */}
          <path className="crane-bush" d={BUSH_PATH} transform="translate(140 330)" />
          <path className="crane-bush" d={BUSH_PATH} transform="translate(1155 330)" />
        </svg>
      </div>

      {result && <ResultStamp won={won} text={won ? stampWon : stampLost} />}

      <div className="challenge-actions crane-actions">
        <button
          type="button"
          className="btn btn-stay crane-btn"
          data-sfx="none"
          disabled={shot || result !== null}
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
