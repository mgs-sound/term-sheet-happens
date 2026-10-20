import { useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { CareerState, GameState } from '../../game/types';
import { careerYears, heirName } from '../../game/career';
import { fillLine, fmtM, pickLine } from '../format';

/**
 * The succession letter (LEGACY.years into a career), between the scorecard
 * and the inbox: hand the keys to your grandchild (a fresh "Jr." career on a
 * new profile) or keep going with one more fund.
 */
export function LegacyScreen({
  game,
  nextCareer,
  lines,
  onHandOver,
  onKeepGoing,
}: {
  game: GameState;
  nextCareer: CareerState;
  lines: FlavorLines;
  onHandOver: () => void;
  onKeepGoing: () => void;
}): JSX.Element {
  const copy = lines.legacy;
  const [confirming, setConfirming] = useState(false);
  const name = nextCareer.playerName ?? lines.profile.onboarding.defaultName;
  const vars = {
    years: String(careerYears(nextCareer)),
    funds: String(nextCareer.ledger.length),
    name,
    heir: heirName(name),
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
      {confirming ? (
        // A stray tap must never end a career: hand-over asks first.
        <div className="screen-actions">
          <p className="legacy-confirm">{fillLine(copy.confirm, vars)}</p>
          <button type="button" className="btn btn-danger" data-sfx="start" onClick={onHandOver}>
            {fillLine(copy.confirmCta, vars)}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-sfx="close"
            onClick={() => setConfirming(false)}
          >
            {copy.cancelCta}
          </button>
        </div>
      ) : (
        <div className="screen-actions">
          <button type="button" className="btn btn-sign" onClick={() => setConfirming(true)}>
            {copy.cta}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onKeepGoing}>
            {copy.stayCta}
          </button>
        </div>
      )}
    </section>
  );
}
