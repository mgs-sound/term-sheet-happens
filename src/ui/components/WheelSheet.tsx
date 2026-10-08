import { useEffect, useRef, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import { wheelAngleAt } from '../../game/engine';
import { WHEEL, WHEEL_VISIBLE_MS } from '../../game/tuning';
import { services } from '../../services';
import { pickLine } from '../format';
import { ResultStamp } from './ResultStamp';

/**
 * Drawing units: the mockup's cover is 351 wide, so the stage is laid out on
 * that grid and scales to the panel. Strokes stay 2px (non-scaling).
 */
const W = 351;
const POINTER = { w: 46, h: 52, shoulder: 30 };
/** Top of the wheel area (just under the pointer's tip). */
const AREA_Y = 60;
const AREA_H = 197;
const CX = W / 2;
const CY = AREA_Y + AREA_H / 2;
const R = 81;

/** The yellow slice, centred on the top (0°), `deg` wide. */
function slicePath(deg: number): string {
  const half = (Math.min(deg, 359.9) / 2) * (Math.PI / 180);
  const x1 = CX + R * Math.sin(-half);
  const y1 = CY - R * Math.cos(-half);
  const x2 = CX + R * Math.sin(half);
  const y2 = CY - R * Math.cos(half);
  const large = deg > 180 ? 1 : 0;
  return `M${CX} ${CY}L${x1} ${y1}A${R} ${R} 0 ${large} 1 ${x2} ${y2}Z`;
}

/** Pepperoni on the slice: [fraction of the half-angle, fraction of R]. */
const PEPPERONI: readonly (readonly [number, number])[] = [
  [-0.7, 0.68],
  [0.55, 0.7],
  [0.1, 0.36],
];

type Stage = 'ready' | 'spinning' | 'blind' | 'done';

/**
 * The blind wheel: a Partner's final offer below the founder's counter. You
 * see where the yellow slice starts; SPIN turns it at a constant speed in
 * plain sight for WHEEL.visibleTurns turns (read the rhythm), then a cover
 * drops over it; STOP when you think the slice is under the pointer. The panel only times the spin — the engine decides (RESOLVE_WHEEL)
 * from the same formula the hidden wheel turns by.
 */
export function WheelSheet({
  lines,
  seed,
  sliceDeg,
  startDeg,
  result,
  stampWon,
  stampLost,
  onStop,
}: {
  lines: FlavorLines;
  seed: number;
  sliceDeg: number;
  startDeg: number;
  /** The engine's verdict (null while spinning or before). */
  result: { stopDeg: number; won: boolean } | null;
  stampWon: string;
  stampLost: string;
  onStop: (elapsedMs: number) => void;
}): JSX.Element {
  const copy = lines.wheel;
  const [stage, setStage] = useState<Stage>(result ? 'done' : 'ready');
  // Seconds until the cover drops (shown on the still-locked STOP button).
  const [hidingIn, setHidingIn] = useState(Math.ceil(WHEEL_VISIBLE_MS / 1000));
  const wheelRef = useRef<SVGGElement>(null);
  const startedAt = useRef(0);
  const stopped = useRef(false);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  const setAngle = (deg: number): void => {
    wheelRef.current?.setAttribute('transform', `rotate(${deg} ${CX} ${CY})`);
  };

  const stop = (): void => {
    if (stopped.current || performance.now() - startedAt.current < WHEEL_VISIBLE_MS) return;
    stopped.current = true;
    const elapsed = performance.now() - startedAt.current;
    setStage('done');
    services.audio.play('finalOffer');
    onStopRef.current(elapsed);
  };

  // While spinning, turn the (hidden) wheel by the engine's own formula; give
  // up and stop by itself after WHEEL.maxSpinMs.
  const turning = stage === 'spinning' || stage === 'blind';
  useEffect(() => {
    if (!turning) return;
    let raf = 0;
    const tick = (): void => {
      const elapsed = performance.now() - startedAt.current;
      setAngle(wheelAngleAt(startDeg, elapsed));
      setHidingIn(Math.max(0, Math.ceil((WHEEL_VISIBLE_MS - elapsed) / 1000)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // A couple of turns in plain sight, then the cover drops (STOP goes live).
    const cover = window.setTimeout(() => {
      setStage('blind');
      services.audio.play('cardFlip');
    }, WHEEL_VISIBLE_MS);
    const giveUp = window.setTimeout(stop, WHEEL_VISIBLE_MS + WHEEL.maxBlindMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cover);
      window.clearTimeout(giveUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turning, startDeg]);

  // Land exactly where the engine says it stopped.
  useEffect(() => {
    setAngle(result ? result.stopDeg : stage === 'ready' ? startDeg : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, startDeg]);

  const spin = (): void => {
    if (stage !== 'ready') return;
    startedAt.current = performance.now();
    setStage('spinning');
    services.audio.play('reroll');
  };

  const covered = stage === 'blind' || (stage === 'done' && !result);

  return (
    <div className="sheet challenge-sheet wheel-sheet" role="dialog" aria-label={copy.title}>
      <div className="challenge-title">{copy.title}</div>
      <p className="challenge-line">
        {result ? pickLine(result.won ? copy.won : copy.lost, seed) : pickLine(copy.intros, seed)}
      </p>

      <div className="wheel-stage" aria-hidden="true">
        <svg className="wheel-art" viewBox={`-2 -2 ${W + 4} ${AREA_Y + AREA_H + 4}`}>
          <path
            className="wheel-pointer"
            d={`M${CX - POINTER.w / 2} 0H${CX + POINTER.w / 2}V${POINTER.shoulder}L${CX} ${POINTER.h}L${CX - POINTER.w / 2} ${POINTER.shoulder}Z`}
          />
          <g ref={wheelRef}>
            <circle className="wheel-red" cx={CX} cy={CY} r={R} />
            <defs>
              <clipPath id="wheel-slice-clip">
                <path d={slicePath(sliceDeg)} />
              </clipPath>
            </defs>
            {/* The slice is a slice of pizza: pepperoni, cut by its edges. */}
            <path className="wheel-slice" d={slicePath(sliceDeg)} />
            <g clipPath="url(#wheel-slice-clip)">
              {PEPPERONI.map(([along, out], i) => {
                const a = along * (sliceDeg / 2) * (Math.PI / 180);
                return (
                  <circle
                    key={i}
                    className="wheel-pepperoni"
                    cx={CX + out * R * Math.sin(a)}
                    cy={CY - out * R * Math.cos(a)}
                    r={R * 0.12}
                  />
                );
              })}
            </g>
            {/* Edge redrawn on top so the pepperoni sit under the crust line. */}
            <path className="wheel-slice-edge" d={slicePath(sliceDeg)} />
          </g>
          {/* The blind: drops over the wheel while it spins. */}
          <rect
            className={`wheel-cover ${covered ? 'is-down' : ''}`}
            x="0"
            y={AREA_Y}
            width={W}
            height={AREA_H}
          />
        </svg>
      </div>

      {result && <ResultStamp won={result.won} text={result.won ? stampWon : stampLost} />}

      <div className="challenge-actions wheel-actions">
        {stage === 'ready' ? (
          <button type="button" className="btn btn-stay wheel-btn" data-sfx="none" onClick={spin}>
            {copy.spinCta}
          </button>
        ) : (
          <button
            type="button"
            className={`btn wheel-btn ${stage === 'spinning' ? 'btn-secondary wheel-hiding' : 'btn-sign'}`}
            data-sfx="none"
            disabled={stage !== 'blind'}
            onPointerDown={(e) => {
              e.preventDefault();
              stop();
            }}
            onClick={(e) => {
              if (e.detail === 0) stop();
            }}
          >
            {stage === 'spinning' ? (
              <>
                <span>{copy.hidingCta.replace('{s}', String(hidingIn))}</span>
                <span className="wheel-hiding-note">{copy.hidingNote}</span>
              </>
            ) : (
              copy.stopCta
            )}
          </button>
        )}
      </div>
    </div>
  );
}
