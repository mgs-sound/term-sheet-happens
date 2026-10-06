import type { CareerState, GameState, Tier } from '../../game/types';
import type { FlavorLines } from '../../content/types';
import type { StayOption } from '../../game/career';
import {
  outsideSummary,
  runEndTrust,
  tierTrend,
  trend,
  trustTrend,
  type Trend,
} from '../../game/rehire';
import { fmtM } from '../format';

const TIER_LABELS: Record<Tier, string> = {
  associate: 'Associate',
  partner: 'Partner',
  gp: 'General Partner',
};

const ARROW: Record<Trend, string> = { up2: '↑↑', up: '↑', same: '=', down: '↓' };


/** RPG arrow next to a figure: green up, red down, faint "=" when unchanged. */
function Arrow({ t }: { t: Trend }): JSX.Element {
  return (
    <span className={`trend trend-${t}`} aria-label={t}>
      {ARROW[t]}
    </span>
  );
}

function Figures({
  copy,
  fundIndex,
  role,
  roleTrend,
  fund,
  fundTrend,
  trust,
  trustTrendValue,
}: {
  copy: FlavorLines['rehire'];
  fundIndex: number;
  role: string;
  roleTrend: Trend;
  fund: string;
  fundTrend: Trend;
  trust: string;
  trustTrendValue: Trend;
}): JSX.Element {
  return (
    <dl className="figures-row rehire-figures">
      <div>
        <dt>{copy.role}</dt>
        <dd>
          {role} <Arrow t={roleTrend} />
        </dd>
      </div>
      <div>
        <dt>{copy.fund.replace('{n}', String(fundIndex))}</dt>
        <dd>
          {fund} <Arrow t={fundTrend} />
        </dd>
      </div>
      <div>
        <dt>{copy.trust}</dt>
        <dd>
          {trust} <Arrow t={trustTrendValue} />
        </dd>
      </div>
    </dl>
  );
}

/**
 * Between funds: the inbox. Stay at the firm you just ran (only if every LP
 * request was met) or take the new-firm market (the engagement letters that
 * follow). Every figure carries an RPG arrow vs. the fund you just ran.
 */
export function RehireScreen({
  game,
  nextCareer,
  stay,
  lines,
  onStay,
  offers,
  onNextFund,
  onNewCareer,
  onLedger,
}: {
  game: GameState;
  nextCareer: CareerState;
  stay: StayOption;
  lines: FlavorLines;
  onStay: () => void;
  /** Preview runs of the new-firm offers (null: GP promotion's LP packages). */
  offers: GameState[] | null;
  onNextFund: () => void;
  onNewCareer: () => void;
  onLedger: () => void;
}): JSX.Element {
  const copy = lines.rehire;
  const promoted = nextCareer.tier !== game.tier;
  const out = outsideSummary(nextCareer);
  const nowTrust = runEndTrust(game);
  const range = (lo: string, hi: string): string => (lo === hi ? lo : `${lo}–${hi}`);

  return (
    <section className="screen letterhead rehire ledger-screen">
      <div className="letterhead-rule">{promoted ? 'Offer letter' : 'Re-engagement letter'}</div>
      <h2 className="rehire-inbox">{copy.inbox}</h2>
      <p className="rehire-intro">{copy.intro}</p>

      {/* Stay: the sign-here yellow block (matches its button). */}
      <section className={`rehire-block rehire-stay ${stay.allowed ? '' : 'is-locked'}`}>
        <h3 className="rehire-block-title">{copy.stayTitle.replace('{firm}', stay.firmName)}</h3>
        <Figures
          copy={copy}
          fundIndex={nextCareer.fundIndex}
          role={TIER_LABELS[stay.tier]}
          roleTrend={tierTrend(game.tier, stay.tier)}
          fund={`~${fmtM(stay.fundSizeM)}`}
          fundTrend={trend(game.fundSizeM, stay.fundSizeM)}
          trust={String(Math.round(stay.lpTrust))}
          trustTrendValue={trustTrend(nowTrust, stay.lpTrust)}
        />
        {!stay.allowed && <p className="rehire-locked">{copy.stayLocked}</p>}
      </section>

      {/* New firm: one read-only row per offer (no profile tags here: those
          live on the engagement letters). "Take new job" opens them. */}
      <section className="rehire-block rehire-outside">
        <h3 className="rehire-block-title">
          {copy.outsideTitle.replace('{n}', String(offers?.length ?? out.lpOffers ?? '')).trim()}
        </h3>
        {offers ? (
          <table className="offer-table">
            <thead>
              <tr>
                <th>{copy.role}</th>
                <th>{copy.fund.replace('{n}', String(nextCareer.fundIndex))}</th>
                <th>{copy.trust}</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.seed}>
                  <td>
                    {TIER_LABELS[o.tier]} <Arrow t={tierTrend(game.tier, o.tier)} />
                  </td>
                  <td>
                    {fmtM(o.fundSizeM)} <Arrow t={trend(game.fundSizeM, o.fundSizeM)} />
                  </td>
                  <td>
                    {Math.round(o.lpTrust)} <Arrow t={trustTrend(nowTrust, o.lpTrust)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
        <Figures
          copy={copy}
          fundIndex={nextCareer.fundIndex}
          role={range(TIER_LABELS[out.tierLow], TIER_LABELS[out.tierHigh])}
          roleTrend={tierTrend(game.tier, out.tierHigh)}
          fund={
            out.lpOffers
              ? copy.lpOffers.replace('{n}', String(out.lpOffers))
              : `~${range(fmtM(out.fundLowM), fmtM(out.fundHighM))}`
          }
          fundTrend={trend(game.fundSizeM, out.fundHighM)}
          trust={range(String(Math.round(out.trustLow)), String(Math.round(out.trustHigh)))}
          trustTrendValue={trustTrend(nowTrust, out.trustHigh)}
        />
        )}
      </section>

      <div className="screen-actions">
        <div className="rehire-choice">
          <button
            type="button"
            className="btn btn-stay"
            data-sfx="sign"
            disabled={!stay.allowed}
            onClick={onStay}
          >
            {copy.stayCta}
          </button>
          <button type="button" className="btn btn-sign" onClick={onNextFund}>
            {copy.leaveCta}
          </button>
        </div>
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
