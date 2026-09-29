import type { GameState } from '../../game/types';
import { reputationStage } from '../../game/meters';
import { fmtM } from '../format';
import { FirmName } from './FirmName';

/** Top ledger strip: firm line + mono meters. */
export function LedgerBar({
  game,
  stageLabels,
}: {
  game: GameState;
  stageLabels: string[];
}): JSX.Element {
  const meetingsLeft = game.meetingsTotal - game.meetingIndex;
  return (
    <header className="ledger-bar">
      <div className="ledger-firm">
        <FirmName name={game.firmName} />
        <span className="ledger-quarter">Q{game.quarter}</span>
      </div>
      <dl className="ledger-meters">
        <div>
          <dt>Dry powder</dt>
          <dd>{fmtM(game.capitalM)}</dd>
        </div>
        <div>
          <dt>Meetings</dt>
          <dd>
            {meetingsLeft}/{game.meetingsTotal}
          </dd>
        </div>
        <div>
          <dt>Rep</dt>
          <dd className="ledger-rep">{stageLabels[reputationStage(game.reputation)]}</dd>
        </div>
        <div>
          <dt>LP trust</dt>
          <dd>{Math.round(game.lpTrust)}</dd>
        </div>
      </dl>
    </header>
  );
}
