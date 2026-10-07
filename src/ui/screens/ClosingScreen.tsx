import type { FirmNameParts, FlavorLines } from '../../content/types';
import type { GameState } from '../../game/types';
import { EXITS } from '../../game/tuning';
import { FitFirmTitle } from '../components/FitFirmTitle';

export function ClosingScreen({
  game,
  firmParts,
  onHarvest,
}: {
  game: GameState;
  lines: FlavorLines;
  firmParts: FirmNameParts;
  onHarvest: () => void;
  onSettings: () => void;
}): JSX.Element {
  return (
    <section className="screen letterhead closing-screen">
      <div className="letterhead-rule">Notice of fund close</div>
      <FitFirmTitle name={game.firmName} parts={firmParts} />
      <p className="letterhead-thesis">
        The checkbook is closed. {game.portfolio.length} companies, {EXITS.harvestYears} years,
        one envelope.
      </p>
      <div className="closing-stamp">FUND CLOSED</div>

      <div className="screen-actions">
        <button type="button" className="btn btn-sign" data-sfx="fastForward" onClick={onHarvest}>
          Fast-forward {EXITS.harvestYears} years
        </button>
      </div>
    </section>
  );
}
