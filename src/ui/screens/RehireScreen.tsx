import type { CareerState, GameState } from '../../game/types';
import type { FlavorLines } from '../../content/types';
import { fmtM, pickLine } from '../format';

const TIER_LABELS = { associate: 'Associate', partner: 'Partner', gp: 'General Partner' };

export function RehireScreen({
  game,
  nextCareer,
  lines,
  onNextFund,
  onNewCareer,
  onLedger,
}: {
  game: GameState;
  nextCareer: CareerState;
  lines: FlavorLines;
  onNextFund: () => void;
  onNewCareer: () => void;
  onLedger: () => void;
}): JSX.Element {
  const promoted = nextCareer.tier !== game.tier;
  const line = promoted
    ? pickLine(lines.poachLines, game.seed)
    : pickLine(lines.rehireCard, game.seed);
  const nextSizeM = nextCareer.pendingOffers ? null : nextCareer.nextFundSizeM;

  return (
    <section className="screen letterhead rehire">
      <div className="letterhead-rule">{promoted ? 'Offer letter' : 'Re-engagement letter'}</div>
      <p className="rehire-line">&ldquo;{line}&rdquo;</p>
      <dl className="figures-row">
        <div>
          <dt>Next role</dt>
          <dd className="rehire-tier">{TIER_LABELS[nextCareer.tier]}</dd>
        </div>
        <div>
          <dt>Fund {nextCareer.fundIndex}</dt>
          <dd>{nextSizeM ? `~${fmtM(nextSizeM)}` : 'LP offers pending'}</dd>
        </div>
        <div>
          <dt>Career AUM</dt>
          <dd>{fmtM(nextCareer.aumM)}</dd>
        </div>
      </dl>
      <div className="screen-actions">
        <button type="button" className="btn btn-sign" onClick={onNextFund}>
          Take the job
        </button>
        <button type="button" className="btn btn-secondary" onClick={onLedger}>
          Career ledger
        </button>
        <button type="button" className="btn btn-text" onClick={onNewCareer}>
          Walk away. Start a new career.
        </button>
      </div>
    </section>
  );
}
