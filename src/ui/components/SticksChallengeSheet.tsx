import { useEffect, useState, type CSSProperties } from 'react';
import type { FlavorLines } from '../../content/types';
import type { StickCall } from '../../game/types';
import { pickLine } from '../format';
import { ChallengeShell } from './ChallengeShell';

/** The cover lifts off the sticks, revealing their lengths (matches sticksDraw). */
export const STICKS_REVEAL_MS = 900;
/**
 * Length while the cover is down. Anything past the cover's left edge (28%)
 * is hidden, so both sticks show identical handles; the real lengths (always
 * longer than the edge, see STICKS.shortMin) just continue under it.
 */
const HIDDEN_PCT = 60;
/** Ruler tick marks. */
const TICKS = 7;

function Stick({ color, length, winner }: { color: 'red' | 'green'; length: number; winner: boolean }) {
  return (
    // --len is the length along the stick's axis (width laid flat, height upright).
    <div
      className={`stick stick-${color} ${winner ? 'stick-winner' : ''}`}
      style={{ '--len': `${length}%` } as CSSProperties}
    >
      {/* Striped handle, then a plain body. */}
      <span className="stick-band" />
      <span className="stick-gap" />
      <span className="stick-band stick-band-thin" />
      <span className="stick-gap" />
      <span className="stick-band stick-band-thin" />
      <span className="stick-body" />
    </div>
  );
}

/** Longest stick: the partner hides two sticks; the longer one wins. */
export function SticksChallengeSheet({
  lines,
  seed,
  result,
  onCall,
}: {
  lines: FlavorLines;
  seed: number;
  result: { call: StickCall; red: number; green: number; won: boolean } | null;
  onCall: (call: StickCall) => void;
}): JSX.Element {
  const copy = lines.vetoChallenge;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(() => setRevealed(true), STICKS_REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [result]);

  // Handles poke out identically; under the cover the sticks run on. Once
  // called they sit at their true lengths (no growing — the change happens
  // under the cover) and the cover lifts off them.
  const opening = result !== null;
  const red = opening ? result.red : HIDDEN_PCT;
  const green = opening ? result.green : HIDDEN_PCT;
  const landed = result !== null && revealed;

  return (
    <ChallengeShell
      title={copy.title}
      line={
        landed
          ? pickLine(result.won ? copy.sticksWon : copy.sticksLost, seed)
          : pickLine(copy.sticksIntros, seed)
      }
      stage={
        // Layout (upright vs flat) is CSS-only: see [data-sticks-flat] in App.css.
        <div className="sticks-stage">
          <div className="ruler" aria-hidden="true">
            {Array.from({ length: TICKS }, (_, i) => (
              <span key={i} className="ruler-tick" />
            ))}
          </div>
          <div className="sticks-lane">
            <Stick color="red" length={red} winner={landed && result.red > result.green} />
            <Stick color="green" length={green} winner={landed && result.green > result.red} />
          </div>
          {/* The partner's closed fist: hides how long the sticks really are. */}
          <div className={`sticks-cover ${opening ? 'sticks-cover-open' : ''}`} aria-hidden="true">
            ?
          </div>
        </div>
      }
      options={[
        { call: 'red', label: 'Red stick' },
        { call: 'green', label: 'Green stick' },
      ]}
      chosen={result?.call ?? null}
      verdict={landed ? result.won : null}
      stampWon={copy.stampWon}
      stampLost={copy.stampLost}
      youChose={copy.youChose}
      sfx="sticksDraw"
      onCall={onCall}
    />
  );
}
