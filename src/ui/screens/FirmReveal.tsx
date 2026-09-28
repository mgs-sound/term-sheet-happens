import type { FlavorLines } from '../../content/types';
import { difficultyBand } from '../../game/fundTerms';
import type { GameState } from '../../game/types';
import { fmtM } from '../format';

const BAND_CLASS = ['label-green', '', 'label-red'] as const;

const TIER_LABELS = { associate: 'ASSOCIATE', partner: 'PARTNER', gp: 'GENERAL PARTNER' };

export function FirmReveal({
  game,
  lines,
  onReroll,
  onOpen,
  onSettings,
}: {
  game: GameState;
  lines: FlavorLines;
  onReroll: () => void;
  onOpen: () => void;
  onSettings: () => void;
}): JSX.Element {
  // Fund I only: the reroll picks a difficulty (see FUND_I_TERMS).
  const band = game.fundIDifficulty === undefined ? null : difficultyBand(game.fundIDifficulty);
  const terms = band === null ? null : lines.fundIDifficulty[band];
  return (
    <section className="screen letterhead">
      <div className="letterhead-rule">Engagement letter</div>
      <p className="letterhead-kicker">
        Fund {game.fundIndex} &middot; {TIER_LABELS[game.tier]}
      </p>
      <h1 className="letterhead-title">{game.firmName}</h1>
      <p className="letterhead-thesis">&ldquo;{game.thesis.line}&rdquo;</p>
      <p className="letterhead-sectors">
        Mandate: {game.thesis.sectors[0]} &middot; {game.thesis.sectors[1]}
      </p>
      <dl className="figures-row">
        <div>
          <dt>Fund size</dt>
          <dd>{fmtM(game.fundSizeM)}</dd>
        </div>
        <div>
          <dt>Meetings</dt>
          <dd>{game.meetingsTotal}</dd>
        </div>
        <div>
          <dt>LP trust</dt>
          <dd>{Math.round(game.lpTrust)}</dd>
        </div>
      </dl>
      {terms && band !== null && (
        <div className="terms-difficulty">
          <span className={`harvest-label ${BAND_CLASS[band]}`}>{terms.label}</span>
          <p className="terms-blurb">{terms.blurb}</p>
        </div>
      )}
      <div className="screen-actions">
        <button type="button" className="btn btn-secondary" onClick={onReroll}>
          Reroll the firm
        </button>
        <button type="button" className="btn btn-sign" onClick={onOpen}>
          Take the meetings
        </button>
        <button type="button" className="btn btn-text" onClick={onSettings}>
          Settings
        </button>
      </div>
    </section>
  );
}
