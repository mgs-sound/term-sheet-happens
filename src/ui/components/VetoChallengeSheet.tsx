import { useEffect, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { CoinSide } from '../../game/types';
import { pickLine } from '../format';

/** Spin length before the coin shows how it landed (matches the coinFlip cue). */
export const COIN_SPIN_MS = 1100;
/** How long the result stays up before the card flies off. */
export const COIN_HOLD_MS = 1100;
/** Face swap speed while spinning. */
const SPIN_FACE_MS = 90;

const FACE: Record<CoinSide, string> = { heads: 'H', tails: 'T' };

/**
 * The partner's "leadership challenge": the deal is parked and settled on a
 * coin. Sits in the same slot as the terms sheet (class `sheet`, so the card
 * lifts above it). Pure presentation: the engine already decided the flip
 * when `result` arrives; this just spins and reveals it.
 */
export function VetoChallengeSheet({
  lines,
  seed,
  result,
  onCall,
}: {
  lines: FlavorLines;
  /** Stable key for picking flavor lines. */
  seed: number;
  /** Set once the player has called it (engine has flipped). */
  result: { call: CoinSide; landed: CoinSide; won: boolean } | null;
  onCall: (call: CoinSide) => void;
}): JSX.Element {
  const copy = lines.vetoChallenge;
  const [spinning, setSpinning] = useState(false);
  // Which side the coin currently shows; null = untossed (grey "?").
  const [face, setFace] = useState<CoinSide | null>(null);

  // Spin: flip the visible face rapidly, then land on the engine's result.
  useEffect(() => {
    if (!result) return;
    setSpinning(true);
    let n = 0;
    const flicker = window.setInterval(() => {
      n += 1;
      setFace(n % 2 ? 'tails' : 'heads');
    }, SPIN_FACE_MS);
    const land = window.setTimeout(() => {
      window.clearInterval(flicker);
      setFace(result.landed);
      setSpinning(false);
    }, COIN_SPIN_MS);
    return () => {
      window.clearInterval(flicker);
      window.clearTimeout(land);
    };
  }, [result]);

  const landed = result !== null && !spinning;

  return (
    <div className="sheet challenge-sheet" role="dialog" aria-label={copy.title}>
      <div className="challenge-title">{copy.title}</div>
      <p className="challenge-line">
        {landed
          ? pickLine(result.won ? copy.won : copy.lost, seed)
          : pickLine(copy.intros, seed)}
      </p>

      <div className="coin-stage">
        {/* Colour = the side showing, matching the buttons: Heads red, Tails
            green, grey before the toss. Win/lose reads from YOU CHOSE. */}
        <div
          className={`coin ${face ? `coin-${face}` : 'coin-idle'} ${
            spinning ? 'coin-spinning' : ''
          } ${landed ? 'coin-landed' : ''}`}
          aria-live="polite"
        >
          {face ? FACE[face] : '?'}
        </div>
      </div>

      <div className="challenge-actions">
        {(['heads', 'tails'] as const).map((side) => {
          const chosen = result?.call === side;
          return (
            <div key={side} className="challenge-option">
              <button
                type="button"
                className={`btn ${side === 'heads' ? 'btn-heads' : 'btn-sign'} ${
                  chosen ? 'is-chosen' : ''
                }`}
                data-sfx="coinFlip"
                disabled={result !== null}
                onClick={() => onCall(side)}
              >
                {side === 'heads' ? 'Heads' : 'Tails'}
              </button>
              {/* Space is always reserved so the tag appearing never shifts layout. */}
              <span className={`you-chose ${chosen ? 'is-shown' : ''}`} aria-hidden={!chosen}>
                {copy.youChose}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
