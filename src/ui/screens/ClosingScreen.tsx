import { useState } from 'react';
import type { FirmNameParts, FlavorLines } from '../../content/types';
import type { GameState } from '../../game/types';
import { EXITS } from '../../game/tuning';
import { FitFirmTitle } from '../components/FitFirmTitle';
import { PortfolioSheet } from '../components/PortfolioSheet';

export function ClosingScreen({
  game,
  lines,
  firmParts,
  onHarvest,
  onTogglePush,
  onSettings,
}: {
  game: GameState;
  lines: FlavorLines;
  firmParts: FirmNameParts;
  onHarvest: () => void;
  onTogglePush: (companyId: string) => void;
  onSettings: () => void;
}): JSX.Element {
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  // Last call for board-seat exit pushes before the fast-forward resolves them.
  const seats = game.portfolio.filter((c) => c.boardSeat && c.status === 'active');
  const pushed = seats.filter((c) => c.pushExit);

  return (
    <section className="screen letterhead closing-screen">
      <div className="letterhead-rule">Notice of fund close</div>
      <FitFirmTitle name={game.firmName} parts={firmParts} />
      <p className="letterhead-thesis">
        The checkbook is closed. {game.portfolio.length} companies, {EXITS.harvestYears} years,
        one envelope.
      </p>
      <div className="closing-stamp">FUND CLOSED</div>

      {seats.length > 0 && (
        <div className="push-reminder">
          <p className="push-reminder-line">
            {pushed.length > 0 ? (
              <>
                Pushing {pushed.length} exit{pushed.length === 1 ? '' : 's'}:{' '}
                <strong>{pushed.map((c) => c.card.name).join(', ')}</strong>
              </>
            ) : (
              <>
                You hold {seats.length} board seat{seats.length === 1 ? '' : 's'}. No exits pushed.
              </>
            )}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            data-sfx="open"
            onClick={() => setPortfolioOpen(true)}
          >
            Review exits
          </button>
        </div>
      )}

      <div className="screen-actions">
        <button type="button" className="btn btn-sign" data-sfx="fastForward" onClick={onHarvest}>
          Fast-forward {EXITS.harvestYears} years
        </button>
      </div>

      {portfolioOpen && (
        <PortfolioSheet
          game={game}
          lines={lines}
          closeLabel="Back to the close"
          onClose={() => setPortfolioOpen(false)}
          onSettings={() => {
            setPortfolioOpen(false);
            onSettings();
          }}
          onTogglePush={onTogglePush}
        />
      )}
    </section>
  );
}
