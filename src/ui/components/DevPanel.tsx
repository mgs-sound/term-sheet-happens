import { useState } from 'react';
import type { GameState } from '../../game/types';
import { services } from '../../services';
import { SFX_IDS } from '../../services/AudioService';

export type DevJump = 'fundI' | 'associate' | 'partner' | 'gp' | 'gate';

/**
 * Dev-only cheat panel (?dev). All mutations route through engine/devtools
 * functions in App — this component is buttons only.
 */
export function DevPanel({
  game,
  onJump,
  onAutoplay,
  onForceDpi,
  onPreviewShare,
  onCoinFlip,
  onHighLow,
  onDice,
  onSticks,
}: {
  game: GameState;
  onJump: (jump: DevJump) => void;
  onAutoplay: () => void;
  onForceDpi: (dpi: number, enlightenGrade: boolean) => void;
  onPreviewShare: () => void;
  onCoinFlip: () => void;
  onHighLow: () => void;
  onDice: () => void;
  onSticks: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  // Minigame graphics are rounded by default; this flips them to hard edges
  // for comparison (sets [data-square], see App.css).
  const [rounded, setRounded] = useState(
    () => typeof document === 'undefined' || !('square' in document.documentElement.dataset),
  );
  const toggleRounded = (): void => {
    const next = !rounded;
    if (next) delete document.documentElement.dataset.square;
    else document.documentElement.dataset.square = '';
    setRounded(next);
  };
  // Longest-stick layout: upright by default, flat for comparison ([data-sticks-flat]).
  const [sticksFlat, setSticksFlat] = useState(
    () => typeof document !== 'undefined' && 'sticksFlat' in document.documentElement.dataset,
  );
  const toggleSticksFlat = (): void => {
    const next = !sticksFlat;
    if (next) document.documentElement.dataset.sticksFlat = '';
    else delete document.documentElement.dataset.sticksFlat;
    setSticksFlat(next);
  };
  const harvested = game.phase === 'harvested';

  return (
    <div className="dev-panel">
      <button type="button" className="dev-toggle" onClick={() => setOpen(!open)}>
        DEV
      </button>
      {open && (
        <div className="dev-body">
          <span className="dev-label">jump</span>
          {(['fundI', 'associate', 'partner', 'gp', 'gate'] as const).map((j) => (
            <button key={j} type="button" onClick={() => onJump(j)}>
              {j}
            </button>
          ))}
          <span className="dev-label">run</span>
          <button type="button" onClick={onAutoplay}>
            autoplay
          </button>
          <span className="dev-label">force dpi {harvested ? '' : '(harvest first)'}</span>
          <button type="button" disabled={!harvested} onClick={() => onForceDpi(1.2, false)}>
            1.2x
          </button>
          <button type="button" disabled={!harvested} onClick={() => onForceDpi(2.5, false)}>
            2.5x
          </button>
          <button type="button" disabled={!harvested} onClick={() => onForceDpi(3.4, true)}>
            3.4x+gate
          </button>
          <span className="dev-label">partner veto</span>
          <button
            type="button"
            disabled={
              game.phase !== 'meeting' ||
              !game.currentCard ||
              game.resolution !== null ||
              game.currentCard.askM > game.capitalM
            }
            onClick={onCoinFlip}
          >
            coin flip
          </button>
          <button
            type="button"
            disabled={
              game.phase !== 'meeting' ||
              !game.currentCard ||
              game.resolution !== null ||
              game.currentCard.askM > game.capitalM
            }
            onClick={onHighLow}
          >
            high/low
          </button>
          <button
            type="button"
            disabled={
              game.phase !== 'meeting' ||
              !game.currentCard ||
              game.resolution !== null ||
              game.currentCard.askM > game.capitalM
            }
            onClick={onDice}
          >
            dice
          </button>
          <button
            type="button"
            disabled={
              game.phase !== 'meeting' ||
              !game.currentCard ||
              game.resolution !== null ||
              game.currentCard.askM > game.capitalM
            }
            onClick={onSticks}
          >
            sticks
          </button>
          <button type="button" className={rounded ? 'dev-on' : ''} onClick={toggleRounded}>
            rounded: {rounded ? 'on' : 'off'}
          </button>
          <button type="button" onClick={toggleSticksFlat}>
            sticks: {sticksFlat ? 'flat' : 'upright'}
          </button>
          <span className="dev-label">sfx (placeholder soundboard)</span>
          {SFX_IDS.map((id) => (
            <button key={id} type="button" data-sfx="none" onClick={() => services.audio.play(id)}>
              {id}
            </button>
          ))}
          <span className="dev-label">share</span>
          <button type="button" disabled={!harvested} onClick={onPreviewShare}>
            preview png
          </button>
        </div>
      )}
    </div>
  );
}
