import type { Content } from '../../content/types';
import type { CareerState } from '../../game/types';
import { verdictBucket } from '../../game/verdict';
import { fmtDpi, fmtM } from '../format';
import { FirmName } from '../components/FirmName';

const TIER_SHORT = { associate: 'ASSOC', partner: 'PTNR', gp: 'GP' };

/** The Career Ledger: one ruled line per fund ever run, plus profile stats. */
export function LedgerScreen({
  career,
  content,
  onShare,
  onBack,
}: {
  career: CareerState;
  content: Content;
  onShare: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <section className="screen letterhead ledger-screen">
      <div className="letterhead-rule">Career ledger</div>

      <dl className="figures-row figures-wrap">
        <div>
          <dt>Career AUM</dt>
          <dd>{fmtM(career.aumM)}</dd>
        </div>
        <div>
          <dt>Returned to LPs</dt>
          <dd>{fmtM(career.totalReturnedM)}</dd>
        </div>
        <div>
          <dt>Unicorns found</dt>
          <dd>{career.unicornsFound}</dd>
        </div>
        <div>
          <dt>Vetoed &amp; right</dt>
          <dd>{career.vetoedUnicorns}</dd>
        </div>
      </dl>
      {career.enlightened && <div className="enlightened-tab">ENLIGHTENED</div>}

      {career.ledger.length === 0 ? (
        <p className="letterhead-thesis">No funds on record. The ledger waits.</p>
      ) : (
        <ul className="ledger-list">
          {[...career.ledger].reverse().map((entry) => {
            const thesis = content.theses.find((t) => t.id === entry.thesisId);
            const stamp = content.lines.verdictStamps[verdictBucket(entry.dpi)];
            const good = entry.dpi >= 1;
            return (
              <li key={entry.fundIndex} className="ledger-row">
                <div className="ledger-row-top">
                  <span className="ledger-row-firm">
                    <span className="mono">F{entry.fundIndex}</span> <FirmName name={entry.firmName} />
                  </span>
                  <span className={`harvest-label ${good ? 'label-green' : 'label-red'}`}>
                    {stamp}
                  </span>
                </div>
                <div className="ledger-row-sub">
                  <span>{TIER_SHORT[entry.tier]}</span>
                  <span className="ledger-row-thesis">
                    {thesis ? `“${thesis.line}”` : '—'}
                  </span>
                </div>
                <div className="ledger-row-nums mono">
                  {fmtM(entry.fundSizeM)} &rarr; {fmtM(entry.returnedM)} &middot;{' '}
                  {fmtDpi(entry.dpi)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="screen-actions">
        <button type="button" className="btn btn-sign" onClick={onShare}>
          Share the flex
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
