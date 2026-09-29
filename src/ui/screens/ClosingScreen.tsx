import type { GameState } from '../../game/types';
import { EXITS } from '../../game/tuning';
import { FirmName } from '../components/FirmName';

export function ClosingScreen({
  game,
  onHarvest,
}: {
  game: GameState;
  onHarvest: () => void;
}): JSX.Element {
  return (
    <section className="screen letterhead">
      <div className="letterhead-rule">Notice of fund close</div>
      <h1 className="letterhead-title">
        <FirmName name={game.firmName} />
      </h1>
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
