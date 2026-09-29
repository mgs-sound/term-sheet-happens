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
}: {
  game: GameState;
  onJump: (jump: DevJump) => void;
  onAutoplay: () => void;
  onForceDpi: (dpi: number, enlightenGrade: boolean) => void;
  onPreviewShare: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
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
