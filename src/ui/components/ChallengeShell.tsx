import type { ReactNode } from 'react';
import type { SfxId } from '../../services';
import { ResultStamp } from './ResultStamp';

/**
 * Shared frame for the partner's minigames: title, flavor line, the game's
 * stage, the YOU WIN / YOU LOSE stamp, and the two call buttons with a
 * YOU CHOSE tag. Left option is always red, right option always green.
 * Class `sheet` keeps it in the terms-sheet slot (the pitch card lifts above).
 */
export function ChallengeShell<C extends string>({
  title,
  line,
  stage,
  options,
  chosen,
  verdict,
  stampWon,
  stampLost,
  youChose,
  sfx,
  onCall,
}: {
  title: string;
  line: string;
  stage: ReactNode;
  /** [left (red), right (green)] */
  options: readonly [{ call: C; label: string }, { call: C; label: string }];
  /** The player's call once made (locks the buttons). */
  chosen: C | null;
  /** null until the result is revealed. */
  verdict: boolean | null;
  stampWon: string;
  stampLost: string;
  youChose: string;
  sfx: SfxId;
  onCall: (call: C) => void;
}): JSX.Element {
  return (
    <div className="sheet challenge-sheet" role="dialog" aria-label={title}>
      <div className="challenge-title">{title}</div>
      <p className="challenge-line">{line}</p>

      {stage}

      {verdict !== null && <ResultStamp won={verdict} text={verdict ? stampWon : stampLost} />}

      <div className="challenge-actions">
        {options.map((opt, i) => {
          const isChosen = chosen === opt.call;
          return (
            <div key={opt.call} className="challenge-option">
              <button
                type="button"
                className={`btn ${i === 0 ? 'btn-heads' : 'btn-sign'} ${isChosen ? 'is-chosen' : ''}`}
                data-sfx={sfx}
                disabled={chosen !== null}
                onClick={() => onCall(opt.call)}
              >
                {opt.label}
              </button>
              <span className={`you-chose ${isChosen ? 'is-shown' : ''}`} aria-hidden={!isChosen}>
                {youChose}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
