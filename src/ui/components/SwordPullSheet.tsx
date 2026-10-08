import { useEffect, useRef, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import { SWORD_PULL } from '../../game/tuning';
import { services } from '../../services';
import { pickLine } from '../format';
import { ResultStamp } from './ResultStamp';

/**
 * Drawing units (the mockup's artboard). The rock is 1200 units wide and is
 * drawn at ~195px, so 1 unit ≈ 0.16px; strokes stay 2px whatever the scale
 * (vector-effect: non-scaling-stroke).
 */
const VIEW = { x: 260, y: 190, w: 1240, h: 1170 };
/** How far the sword climbs before its tip clears the rock top (units). */
const CLEAR_RISE = 420;
/** On a win it keeps going, up and out of the panel. */
const WIN_RISE = 1500;

function Sword(): JSX.Element {
  return (
    <g className="sword-parts">
      {/* Blade, straight down into the stone, with its point. */}
      <path className="sword-blade" d="M885 590H960V1196L922 1238L885 1196Z" />
      {/* Ricasso: the dark band just under the guard. */}
      <rect className="sword-ink" x="885" y="590" width="75" height="22" />
      <path className="sword-grip" d="M898 300H945L957 506H888Z" />
      <path className="sword-gold" d="M752 540L922 505L1095 540V592H752Z" />
      <circle className="sword-gold" cx="922" cy="255" r="45" />
    </g>
  );
}

function Rock(): JSX.Element {
  return (
    <g>
      <path className="sword-rock" d="M505 820H1290L1480 1340H280L505 1085Z" />
      {/* The crack. */}
      <path className="sword-crack" d="M810 820V1050L960 1180L835 1340" />
    </g>
  );
}

/**
 * Sword in the stone: a Partner's final offer below the founder's counter.
 * Tap as fast as you can; the first tap starts SWORD_PULL.durationMs. Each tap
 * raises the sword; reach `targetTaps` and it comes out. The panel only
 * counts taps — the engine decides (RESOLVE_SWORD_PULL) via `onDone`.
 */
export function SwordPullSheet({
  lines,
  seed,
  targetTaps,
  result,
  stampWon,
  stampLost,
  onDone,
}: {
  lines: FlavorLines;
  seed: number;
  targetTaps: number;
  /** The engine's verdict once the time is up (null while pulling). */
  result: { taps: number; won: boolean } | null;
  stampWon: string;
  stampLost: string;
  onDone: (taps: number) => void;
}): JSX.Element {
  const copy = lines.swordPull;
  const [taps, setTaps] = useState(0);
  const [started, setStarted] = useState(false);
  const [jolt, setJolt] = useState(0);
  const tapsRef = useRef(0);
  const doneRef = useRef(false);
  // Latest callback, so re-renders on every tap never restart the clock.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // The clock runs from the first tap; when it's out, hand the count over.
  useEffect(() => {
    if (!started) return;
    const t = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current(tapsRef.current);
    }, SWORD_PULL.durationMs);
    return () => window.clearTimeout(t);
  }, [started]);

  const tap = (): void => {
    if (doneRef.current) return;
    if (!started) setStarted(true);
    tapsRef.current += 1;
    setTaps(tapsRef.current);
    setJolt((j) => j + 1);
    services.audio.play('tick');
    void services.haptics.tap();
  };

  const progress = Math.min(1, (result?.taps ?? taps) / targetTaps);
  const rise = result ? (result.won ? WIN_RISE : 0) : progress * CLEAR_RISE;

  return (
    <div className="sheet challenge-sheet sword-sheet" role="dialog" aria-label={copy.title}>
      <div className="challenge-title">{copy.title}</div>
      <p className="challenge-line">
        {result
          ? pickLine(result.won ? copy.won : copy.lost, seed)
          : pickLine(copy.intros, seed)}
      </p>

      <div className="sword-stage" aria-hidden="true">
        <svg
          className="sword-art"
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
          overflow="visible"
        >
          <g
            className={`sword-lift ${result ? (result.won ? 'is-won' : 'is-lost') : ''}`}
            style={{ transform: `translateY(${-rise}px)` }}
          >
            {/* Re-keyed per tap so the wobble replays. */}
            <g key={jolt} className={jolt > 0 && !result ? 'sword-jolt' : ''}>
              <Sword />
            </g>
          </g>
          <Rock />
        </svg>
      </div>

      {/* Time left: an ink rule that runs down from the first tap. */}
      <div className={`sword-clock ${started ? 'is-on' : ''}`} aria-hidden="true">
        <span
          className={`sword-clock-fill ${started ? 'is-running' : ''}`}
          style={{ animationDuration: `${SWORD_PULL.durationMs}ms` }}
        />
      </div>

      {result && <ResultStamp won={result.won} text={result.won ? stampWon : stampLost} />}

      <div className="challenge-actions sword-actions">
        <button
          type="button"
          className="btn btn-stay sword-pull-btn"
          data-sfx="none"
          disabled={result !== null}
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          // Keyboard (Enter/Space) arrives as a click with no pointer.
          onClick={(e) => {
            if (e.detail === 0) tap();
          }}
        >
          {copy.cta}
        </button>
      </div>
    </div>
  );
}
