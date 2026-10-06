import type { FirmNameParts, FlavorLines } from '../../content/types';
import { difficultyBand } from '../../game/fundTerms';
import type { GameState } from '../../game/types';
import { fmtM } from '../format';
import { FitFirmTitle } from '../components/FitFirmTitle';
import { LpRequestList } from '../components/LpRequestList';

const BAND_CLASS = ['label-green', '', 'label-red'] as const;
/** Same colour language as Fund I's bands: easiest DPI green, riskiest red. */
const PROFILE_CLASS = { dealFlow: 'label-green', lpDarling: '', bigChecks: 'label-red' } as const;

const TIER_LABELS = { associate: 'ASSOCIATE', partner: 'PARTNER', gp: 'GENERAL PARTNER' };

export function FirmReveal({
  game,
  lines,
  firmParts,
  optionIndex,
  optionCount,
  canReroll,
  onReroll,
  onOpen,
  onSettings,
}: {
  game: GameState;
  lines: FlavorLines;
  firmParts: FirmNameParts;
  /** Which of the fixed firm options is showing (0-based) and how many exist. */
  optionIndex: number;
  optionCount: number;
  /** False when nothing visible would change (GP-named firm + LP thesis). */
  canReroll: boolean;
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
      <FitFirmTitle name={game.firmName} parts={firmParts} />
      <p className="letterhead-thesis thesis-fixed">&ldquo;{game.thesis.line}&rdquo;</p>
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
      {/* Fund II+: what this offer trades (same slot as Fund I's difficulty). */}
      {game.offerProfile && (
        <div className="terms-difficulty">
          <span className={`harvest-label ${PROFILE_CLASS[game.offerProfile]}`}>
            {lines.offerProfiles[game.offerProfile].label}
          </span>
          <p className="terms-blurb">{lines.offerProfiles[game.offerProfile].blurb}</p>
        </div>
      )}
      <LpRequestList requests={game.lpRequests} lines={lines} note />
      <div className="screen-actions">
        {canReroll && (
          <button type="button" className="btn btn-secondary" data-sfx="reroll" onClick={onReroll}>
            {game.isFundI || game.offerProfile
              ? lines.jobs.nextOffer
                  .replace('{i}', String(optionIndex + 1))
                  .replace('{n}', String(optionCount))
              : <>Reroll the firm &middot; {optionIndex + 1}/{optionCount}</>}
          </button>
        )}
        <button type="button" className="btn btn-sign" data-sfx="start" onClick={onOpen}>
          Take the meetings
        </button>
        <button type="button" className="btn btn-text" data-sfx="open" onClick={onSettings}>
          Settings
        </button>
      </div>
    </section>
  );
}
