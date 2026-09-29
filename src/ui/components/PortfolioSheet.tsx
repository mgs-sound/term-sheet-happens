import type { FlavorLines } from '../../content/types';
import type { GameState } from '../../game/types';
import { fmtM, pickLine, STAGE_LABELS } from '../format';
import { fontForCompany, fontsForDeck } from '../fonts/cardFonts';
import { FirmName } from './FirmName';
import { BOARD_SEATS } from '../../game/tuning';

/**
 * Mid-run portfolio: the companies signed so far, styled like the harvest
 * distribution notice but with no exit column (outcomes resolve at harvest).
 * Read-only overlay over the run screen — no engine actions.
 */
export function PortfolioSheet({
  game,
  lines,
  onClose,
  onSettings,
  onTogglePush,
  closeLabel = 'Back to the meetings',
}: {
  game: GameState;
  lines: FlavorLines;
  onClose: () => void;
  /** Flip the board-seat exit push for a company (engine: TOGGLE_PUSH_EXIT). */
  onTogglePush: (companyId: string) => void;
  closeLabel?: string;
  /** Settings (incl. "Leave the industry" reset), reachable mid-run from here. */
  onSettings: () => void;
}): JSX.Element {
  const deckFonts = fontsForDeck(game.deck);
  const deployedM = game.portfolio.reduce((sum, c) => sum + c.investedM, 0);
  const alive = game.portfolio.filter((c) => c.status === 'active').length;
  const improvePct = Math.round(BOARD_SEATS.pushImproveChance * 100);

  return (
    <section
      className="screen letterhead harvest-screen portfolio-sheet"
      role="dialog"
      aria-label="Portfolio"
    >
      <div className="letterhead-rule">Portfolio &mdash; interim</div>
      <p className="letterhead-kicker">
        <FirmName name={game.firmName} /> &middot; Q{game.quarter}
      </p>

      <dl className="figures-row">
        <div>
          <dt>Companies</dt>
          <dd>
            {alive}/{game.portfolio.length}
          </dd>
        </div>
        <div>
          <dt>Deployed</dt>
          <dd>{fmtM(deployedM)}</dd>
        </div>
        <div>
          <dt>Dry powder</dt>
          <dd>{fmtM(game.capitalM)}</dd>
        </div>
      </dl>

      {game.portfolio.length === 0 ? (
        <p className="letterhead-thesis">{pickLine(lines.portfolioEmpty, game.seed)}</p>
      ) : (
        <ul className="harvest-list">
          {game.portfolio.map((c) => {
            const dead = c.status === 'writtenOff';
            const tags = [
              c.card.sector.toUpperCase(),
              STAGE_LABELS[c.card.stage],
              c.card.onThesis ? 'ON-THESIS' : 'OFF-THESIS',
              c.boardSeat ? 'BOARD SEAT' : null,
              c.bridged ? 'BRIDGED' : null,
            ].filter(Boolean);
            return (
              <li key={c.companyId} className={`harvest-row ${dead ? 'portfolio-dead' : ''}`}>
                <div className="harvest-row-top">
                  <span className="harvest-name" data-font={fontForCompany(deckFonts, c.companyId)}>
                    {c.card.name}
                  </span>
                  <span className={`harvest-label ${dead ? 'label-red' : 'label-green'}`}>
                    {dead ? lines.portfolioStatusLabels.writtenOff : lines.portfolioStatusLabels.active}
                  </span>
                </div>
                <div className="harvest-row-nums">
                  in {fmtM(c.investedM)} &middot; {(c.ownership * 100).toFixed(1)}% owned
                </div>
                <div className="portfolio-tags">{tags.join(' · ')}</div>
                {c.boardSeat && !dead && (
                  <label className={`push-row ${c.pushExit ? 'push-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={c.pushExit === true}
                      onChange={() => onTogglePush(c.companyId)}
                    />
                    <span>
                      <strong>Push the exit</strong> at harvest{' '}
                      <span className="push-odds">
                        {improvePct}%: &times;{BOARD_SEATS.pushMultiplier} &middot;{' '}
                        {100 - improvePct}%: zero
                      </span>
                    </span>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="screen-actions">
        <button type="button" className="btn btn-sign" data-sfx="close" onClick={onClose}>
          {closeLabel}
        </button>
        <button type="button" className="btn btn-text" data-sfx="open" onClick={onSettings}>
          Settings
        </button>
      </div>
    </section>
  );
}
