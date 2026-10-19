import type { FlavorLines } from '../../content/types';
import type { CareerState, GameState } from '../../game/types';
import { careerYears } from '../../game/career';
import { fillLine, fmtM, pickLine } from '../format';

/**
 * The century letter (LEGACY.years into a career): one beat of comedy
 * between the scorecard and the inbox — the grandchildren take over.
 * Purely presentational; nothing about the career changes.
 */
export function LegacyScreen({
  game,
  nextCareer,
  lines,
  onContinue,
}: {
  game: GameState;
  nextCareer: CareerState;
  lines: FlavorLines;
  onContinue: () => void;
}): JSX.Element {
  const copy = lines.legacy;
  const vars = {
    years: String(careerYears(nextCareer)),
    funds: String(nextCareer.ledger.length),
    name: nextCareer.playerName ?? lines.profile.onboarding.defaultName,
  };
  return (
    <section className="screen letterhead legacy">
      <div className="letterhead-rule">{copy.rule}</div>
      <h1 className="letterhead-title">{fillLine(copy.title, vars)}</h1>
      <p className="letterhead-thesis">{fillLine(pickLine(copy.lines, game.seed), vars)}</p>
      <dl className="figures-row">
        <div>
          <dt>Funds</dt>
          <dd>{vars.funds}</dd>
        </div>
        <div>
          <dt>Career AUM</dt>
          <dd>{fmtM(nextCareer.aumM)}</dd>
        </div>
        <div>
          <dt>Returned</dt>
          <dd>{fmtM(nextCareer.totalReturnedM)}</dd>
        </div>
      </dl>
      <div className="screen-actions">
        <button type="button" className="btn btn-sign" onClick={onContinue}>
          {copy.cta}
        </button>
      </div>
    </section>
  );
}
