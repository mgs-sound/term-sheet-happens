import { useEffect, useRef, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { DiceCall } from '../../game/types';
import { pickLine } from '../format';
import { useReducedMotion } from '../useReducedMotion';
import { ChallengeShell } from './ChallengeShell';

/** Total time until the die settles on the engine's roll (matches the diceRoll cue). */
export const DICE_ROLL_MS = 1300;
/**
 * Quarter-turns the die rolls through. Each quarter it "tips" onto a new face,
 * so with the decelerating spin the face changes naturally space out too.
 * A multiple of 4 so it comes to rest upright.
 */
const QUARTER_TURNS = 12;

/** Pip positions on a 3x3 grid (0..8, row-major) for each face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/**
 * Offset from the roll for the face shown with `k` more tips to go
 * (k = 0 is the final quarter-turn). Odd k → odd offset, even k → even, so
 * the tumble alternates parity and never hints at even/odd; consecutive faces
 * always differ; it doesn't open on the result.
 */
const TUMBLE_OFFSETS = [0, 1, 2, 5, 0, 3, 4, 1, 2, 5, 0, 3];

/**
 * Face during quarter-turn `q` (0-based). The LAST quarter already shows the
 * roll: the slow, decelerating finish settles onto the face you'll get, so
 * there's no last-instant swap.
 */
export function faceAt(q: number, roll: number): number {
  const k = Math.max(0, QUARTER_TURNS - 1 - Math.min(q, QUARTER_TURNS - 1));
  const offset = TUMBLE_OFFSETS[k] ?? 0;
  return ((roll - 1 + offset) % 6) + 1;
}

/** Even or odd: the partner rolls one die. Flat, front face only. */
export function DiceChallengeSheet({
  lines,
  seed,
  result,
  onCall,
}: {
  lines: FlavorLines;
  seed: number;
  result: { call: DiceCall; roll: number; won: boolean } | null;
  onCall: (call: DiceCall) => void;
}): JSX.Element {
  const copy = lines.vetoChallenge;
  const reducedMotion = useReducedMotion();
  const [angle, setAngle] = useState(0);
  const [face, setFace] = useState(3);
  const [settled, setSettled] = useState(false);
  const lastQuarter = useRef(-1);

  // One continuous in-plane roll that decelerates (ease-out); the face flips
  // every quarter-turn, like a die tipping over its edges as it slows down.
  useEffect(() => {
    if (!result) return;
    if (reducedMotion) {
      setFace(result.roll);
      setSettled(true);
      return;
    }
    const total = QUARTER_TURNS * 90;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number): void => {
      const p = Math.min(1, Math.max(0, (now - t0) / DICE_ROLL_MS));
      const eased = 1 - Math.pow(1 - p, 3);
      const a = total * eased;
      setAngle(a);
      const q = Math.min(QUARTER_TURNS - 1, Math.floor(a / 90));
      if (q !== lastQuarter.current) {
        lastQuarter.current = q;
        setFace(faceAt(q, result.roll));
      }
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        setAngle(0); // a whole number of turns: upright, same visual pose
        setSettled(true);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [result, reducedMotion]);

  const rolling = result !== null && !settled;
  const landed = result !== null && settled;
  const tone = landed ? (result.roll % 2 === 0 ? 'even' : 'odd') : 'ink';

  return (
    <ChallengeShell
      title={copy.title}
      line={
        landed
          ? pickLine(result.won ? copy.diceWon : copy.diceLost, seed)
          : pickLine(copy.diceIntros, seed)
      }
      stage={
        <div className={`dice-stage ${rolling ? 'dice-rolling' : ''} ${landed ? 'dice-landed' : ''}`}>
          <div className="die-hop">
            {/* Settled die wears its parity: even red, odd green (like the buttons). */}
            <div
              className={`die die-${tone}`}
              style={{ transform: `rotate(${angle}deg)` }}
              aria-label={landed ? `Die shows ${result.roll}` : 'Die'}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={`pip ${PIPS[face]?.includes(i) ? 'pip-on' : ''}`} />
              ))}
            </div>
          </div>
        </div>
      }
      options={[
        { call: 'even', label: 'Even' },
        { call: 'odd', label: 'Odd' },
      ]}
      chosen={result?.call ?? null}
      verdict={landed ? result.won : null}
      stampWon={copy.stampWon}
      stampLost={copy.stampLost}
      youChose={copy.youChose}
      sfx="diceRoll"
      onCall={onCall}
    />
  );
}
