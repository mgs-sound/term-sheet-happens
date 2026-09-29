import type { GameState } from '../../game/types';
import type { FlavorLines } from '../../content/types';
import { verdictBucket } from '../../game/verdict';
import { fmtDpi, fmtM, pickLine } from '../format';
import { FirmName } from '../components/FirmName';

export function ScorecardScreen({
  game,
  lines,
  onShare,
  onContinue,
}: {
  game: GameState;
  lines: FlavorLines;
  onShare: () => void;
  onContinue: () => void;
}): JSX.Element {
  const harvest = game.harvest;
  if (!harvest) return <section className="screen" />;
  const bucket = verdictBucket(harvest.dpi);
  const verdict = pickLine(lines.verdicts[bucket], game.seed);
  const good = harvest.dpi >= 1;

  return (
    <section className="screen letterhead scorecard">
      <div className="letterhead-rule">Internal memorandum &mdash; final</div>
      <p className="letterhead-kicker">
        <FirmName name={game.firmName} /> &middot; Fund {game.fundIndex}
      </p>
      <div className={`dpi-block ${good ? 'dpi-good' : 'dpi-bad'}`}>
        <span className="dpi-label">DPI</span>
        <span className="dpi-value">{fmtDpi(harvest.dpi)}</span>
      </div>
      <p className="letterhead-thesis verdict-line">&ldquo;{verdict}&rdquo;</p>
      <dl className="figures-row figures-wrap">
        <div>
          <dt>Fund</dt>
          <dd>{fmtM(game.fundSizeM)}</dd>
        </div>
        <div>
          <dt>Returned</dt>
          <dd>{fmtM(harvest.returnedM)}</dd>
        </div>
        <div>
          <dt>Checks</dt>
          <dd>{game.portfolio.length}</dd>
        </div>
        <div>
          <dt>Unicorns</dt>
          <dd>{harvest.unicorns}</dd>
        </div>
      </dl>
      {harvest.vetoedUnicorns > 0 && (
        <p className="heartbreak">
          Vetoed unicorns you were right about: {harvest.vetoedUnicorns}
        </p>
      )}
      <div className="screen-actions">
        <button type="button" className="btn btn-secondary" onClick={onShare}>
          Share the memo
        </button>
        <button type="button" className="btn btn-sign" onClick={onContinue}>
          What now?
        </button>
      </div>
    </section>
  );
}
