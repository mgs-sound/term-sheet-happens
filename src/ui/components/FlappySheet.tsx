import { useEffect, useRef, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import { flappyAt, obstacleTriangles } from '../../game/flappy';
import { FLAPPY } from '../../game/tuning';
import type { FlappyObstacle } from '../../game/types';
import { services } from '../../services';
import { pickLine } from '../format';
import { CraneArt } from './CraneSheet';
import { ResultStamp } from './ResultStamp';

/** The crane art is 360×240 around (180,120); drawn at this scale. */
const CRANE_SCALE = 0.6;

function craneTransform(y: number, vy: number): string {
  // Nose up when climbing, down when falling.
  const tilt = Math.max(-25, Math.min(55, vy * 30));
  return `translate(${FLAPPY.craneX} ${y}) rotate(${tilt}) scale(${-CRANE_SCALE} ${CRANE_SCALE}) translate(-180 -120)`;
}

/**
 * Flappy crane: a Partner's final offer below the founder's counter. Tap to
 * flap the origami crane through five green triangles; touch one (or the
 * ceiling / floor) and the deal is gone. The first tap takes off. The panel
 * only records the taps — the engine replays them (RESOLVE_FLAPPY) with the
 * same physics this panel draws.
 */
export function FlappySheet({
  lines,
  seed,
  course: courseProp,
  result,
  stampWon,
  stampLost,
  onDone,
}: {
  lines: FlavorLines;
  seed: number;
  course: FlappyObstacle[];
  result: { won: boolean } | null;
  stampWon: string;
  stampLost: string;
  onDone: (tapsMs: number[]) => void;
}): JSX.Element {
  const copy = lines.flappy;
  // Fixed on mount: the engine clears its copy once it settles.
  const [course] = useState(courseProp);
  const craneRef = useRef<SVGGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const taps = useRef<number[]>([]);
  const startedAt = useRef<number | null>(null);
  const over = useRef(false);
  const [started, setStarted] = useState(false);
  const [passed, setPassed] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let raf = 0;
    const born = performance.now();
    let lastPassed = 0;
    const tick = (): void => {
      const now = performance.now();
      if (startedAt.current === null) {
        // Waiting for the first tap: hover with a little bob.
        const bob = Math.sin((now - born) / 260) * 18;
        craneRef.current?.setAttribute('transform', craneTransform(FLAPPY.height / 2 + bob, 0));
        raf = requestAnimationFrame(tick);
        return;
      }
      const s = flappyAt(course, taps.current, now - startedAt.current);
      craneRef.current?.setAttribute('transform', craneTransform(s.y, s.vy));
      worldRef.current?.setAttribute('transform', `translate(${-s.scroll} 0)`);
      if (s.passed !== lastPassed) {
        lastPassed = s.passed;
        setPassed(s.passed);
        services.audio.play('tick');
      }
      if (s.crashed || s.finished) {
        over.current = true;
        if (s.crashed) services.audio.play('denied');
        onDoneRef.current([...taps.current]);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flap = (): void => {
    if (over.current || result) return;
    const now = performance.now();
    if (startedAt.current === null) {
      startedAt.current = now;
      setStarted(true);
    }
    taps.current.push(now - startedAt.current);
    services.audio.play('draft'); // paper wings
  };

  return (
    <div className="sheet challenge-sheet flappy-sheet" role="dialog" aria-label={copy.title}>
      <div className="challenge-title">{copy.title}</div>
      <p className="challenge-line">
        {result ? pickLine(result.won ? copy.won : copy.lost, seed) : pickLine(copy.intros, seed)}
      </p>

      <div className="flappy-stage" aria-hidden="true">
        <svg className="flappy-art" viewBox={`0 0 ${FLAPPY.width} ${FLAPPY.height}`}>
          <rect className="flappy-sky" x="0" y="0" width={FLAPPY.width} height={FLAPPY.height} />
          <g ref={worldRef}>
            {course.flatMap((o, i) =>
              obstacleTriangles(o).map((tri, j) => {
                // tri = [apex, base-left, base-right]. The base lies on the
                // frame, so it gets no stroke of its own: fill the triangle,
                // stroke only its two sides; the frame's border is the base.
                const [apex, left, right] = tri;
                return (
                  <g key={`${i}-${j}`}>
                    <path
                      className="flappy-tri"
                      d={`M${tri.map((p) => p.join(' ')).join('L')}Z`}
                    />
                    <path
                      className="flappy-tri-sides"
                      d={`M${left!.join(' ')}L${apex!.join(' ')}L${right!.join(' ')}`}
                    />
                  </g>
                );
              }),
            )}
          </g>
          <g ref={craneRef} transform={craneTransform(FLAPPY.height / 2, 0)}>
            <CraneArt />
          </g>
        </svg>
        {!started && !result && <div className="flappy-hint">{copy.startHint}</div>}
      </div>

      {/* Progress: one box per obstacle, ticked as it's cleared. */}
      <div className="crane-score" aria-label="Obstacles cleared">
        {course.map((_, i) => (
          <span key={i} className={`crane-mark ${i < passed ? 'is-hit' : ''}`}>
            {i < passed ? '✓' : ''}
          </span>
        ))}
      </div>

      {result && <ResultStamp won={result.won} text={result.won ? stampWon : stampLost} />}

      <div className="challenge-actions flappy-actions">
        <button
          type="button"
          className="btn btn-stay flappy-btn"
          data-sfx="none"
          disabled={result !== null}
          onPointerDown={(e) => {
            e.preventDefault();
            flap();
          }}
          onClick={(e) => {
            if (e.detail === 0) flap();
          }}
        >
          {copy.cta}
        </button>
      </div>
    </div>
  );
}
