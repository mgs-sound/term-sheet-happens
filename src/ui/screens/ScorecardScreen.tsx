import type { GameState } from '../../game/types';
import type { CarryEquivalences, FlavorLines } from '../../content/types';
import { pickCarryLine } from '../../content/carry';
import { verdictBucket } from '../../game/verdict';
import { fillLine, fmtDpi, fmtM, pickLine } from '../format';

export function ScorecardScreen({
  game,
  lines,
  carryEq,
  onShare,
  onContinue,
}: {
  game: GameState;
  lines: FlavorLines;
  carryEq: CarryEquivalences;
  onShare: () => void;
  onContinue: () => void;
}): JSX.Element {
  const harvest = game.harvest;
  if (!harvest) return <section className="screen" />;
  const bucket = verdictBucket(harvest.dpi);
  const verdict = pickLine(lines.verdicts[bucket], game.seed);
  const good = harvest.dpi >= 1;
  const equivalence = fillLine(pickCarryLine(carryEq, harvest.carryM, game.seed), {
    carry: fmtM(harvest.carryM),
  });

  return (
    <section className="screen letterhead scorecard">
      <div className="letterhead-rule">Internal memorandum &mdash; final</div>
      <p className="letterhead-kicker">
        {game.firmName} &middot; Fund {game.fundIndex}
      </p>
      <div className={`dpi-block ${good ? 'dpi-good' : 'dpi-bad'}`}>
        <span className="dpi-label">DPI</span>
        <span className="dpi-value">{fmtDpi(harvest.dpi)}</span>
      </div>
      <p className="letterhead-thesis verdict-line">&ldquo;{verdict}&rdquo;</p>
      <div className="carry-block">
        <span className="carry-line">YOUR CARRY: {fmtM(harvest.carryM)}</span>
        <p className="carry-equivalence">{equivalence}</p>
      </div>
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
