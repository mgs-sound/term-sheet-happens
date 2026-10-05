import type { Content } from '../../content/types';
import { reputationStage } from '../../game/meters';
import type { CareerState, Tier } from '../../game/types';
import { verdictBucket } from '../../game/verdict';
import { fmtDpi, fmtM } from '../format';
import { FirmName } from '../components/FirmName';
import { ProfileHead } from '../components/ProfileHead';

const TIER_TITLE: Record<Tier, string> = {
  associate: 'Associate',
  partner: 'Partner',
  gp: 'General Partner',
};

/**
 * The Career Ledger, dressed as a networking profile: who you are now,
 * one "Experience" entry per fund ever run (newest first), and skills that
 * your record has, regrettably, earned. Read-only; all copy in lines.json.
 */
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
  const copy = content.lines.profile;
  const ledger = career.ledger;
  const latest = ledger[ledger.length - 1];
  const openToWork = career.lastFundDpi !== null && career.lastFundDpi < 1;
  const stage = reputationStage(career.reputation);
  const fundsReturned = ledger.filter((e) => e.dpi >= 1).length;

  // Skills the record has earned (base ones always; the rest by stat).
  const skills = [
    ...copy.skills.base,
    career.unicornsFound > 0 ? copy.skills.unicorns : null,
    career.vetoedUnicorns > 0 ? copy.skills.vetoedRight : null,
    ledger.length > 0 ? (fundsReturned > 0 ? copy.skills.returned : copy.skills.neverReturned) : null,
    career.enlightened ? copy.skills.enlightened : null,
  ].filter((s): s is string => s !== null);

  return (
    <section className="screen letterhead ledger-screen profile-screen">
      <div className="letterhead-rule">{copy.title}</div>

      <ProfileHead
        name={career.playerName}
        placeholder={copy.onboarding.defaultName}
        headline={
          <>
            {TIER_TITLE[career.tier]}
            {latest && (
              <>
                {' '}
                &middot; ex-<FirmName name={latest.firmName} />
              </>
            )}
          </>
        }
        about={copy.aboutByStage[stage] ?? copy.aboutByStage[0]}
      />
      {openToWork && <span className="harvest-label label-red profile-badge">{copy.openToWork}</span>}
      {career.enlightened && <div className="enlightened-tab">ENLIGHTENED</div>}

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

      <h2 className="profile-section">{copy.experienceTitle}</h2>
      {ledger.length === 0 ? (
        <p className="letterhead-thesis">{copy.empty}</p>
      ) : (
        <ul className="ledger-list">
          {[...ledger].reverse().map((entry) => {
            const thesis = content.theses.find((t) => t.id === entry.thesisId);
            const stamp = content.lines.verdictStamps[verdictBucket(entry.dpi)];
            const good = entry.dpi >= 1;
            return (
              <li key={entry.fundIndex} className="ledger-row">
                <div className="ledger-row-top">
                  <span className="profile-role">{TIER_TITLE[entry.tier]}</span>
                  <span className={`harvest-label ${good ? 'label-green' : 'label-red'}`}>
                    {stamp}
                  </span>
                </div>
                <div className="ledger-row-firm">
                  <FirmName name={entry.firmName} />
                </div>
                <div className="ledger-row-sub">
                  <span>F{entry.fundIndex}</span>
                  <span className="ledger-row-thesis">{thesis ? `“${thesis.line}”` : '—'}</span>
                </div>
                <div className="ledger-row-nums mono">
                  {fmtM(entry.fundSizeM)} fund &rarr; returned {fmtM(entry.returnedM)} &middot;{' '}
                  {fmtDpi(entry.dpi)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="profile-section">{copy.skillsTitle}</h2>
      <ul className="profile-skills">
        {skills.map((s) => (
          <li key={s} className="profile-skill">
            {s}
          </li>
        ))}
      </ul>
      <p className="profile-endorsed">{copy.endorsed.replace('{n}', String(fundsReturned))}</p>

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
