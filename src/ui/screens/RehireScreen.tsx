import type { ReactNode } from 'react';
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

/** Fill a {key} template, setting each value as a bold mono figure. */
function fill(template: string, vars: Record<string, string>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key !== undefined && key in vars ? (
      <b key={i} className="rehire-sealed-figure">
        {vars[key]}
      </b>
    ) : (
      part
    );
  });
}

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
  /** Null: no arrow (an offer that isn't on the table). */
  roleTrend: Trend | null;
  fund: string;
  fundTrend: Trend | null;
  trust: string;
  trustTrendValue: Trend | null;
}): JSX.Element {
  return (
    <dl className="figures-row rehire-figures">
      <div>
        <dt>{copy.role}</dt>
        <dd>
          {role} {roleTrend && <Arrow t={roleTrend} />}
        </dd>
      </div>
      <div>
        <dt>{copy.fund.replace('{n}', String(fundIndex))}</dt>
        <dd>
          {fund} {fundTrend && <Arrow t={fundTrend} />}
        </dd>
      </div>
      <div>
        <dt>{copy.trust}</dt>
        <dd>
          {trust} {trustTrendValue && <Arrow t={trustTrendValue} />}
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

  return (
    <section className="screen letterhead rehire ledger-screen">
      <div className="letterhead-rule">{promoted ? 'Offer letter' : 'Re-engagement letter'}</div>
      <h2 className="rehire-inbox">{copy.inbox}</h2>
      <p className="rehire-intro">{copy.intro}</p>

      {/* Stay: the sign-here yellow block (matches its button). */}
      <section className={`rehire-block rehire-stay ${stay.allowed ? '' : 'is-locked'}`}>
        <h3 className="rehire-block-title">{copy.stayTitle.replace('{firm}', stay.firmName)}</h3>
        {stay.allowed ? (
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
        ) : (
          // Not on the table: nothing to compare, so no arrows.
          <Figures
            copy={copy}
            fundIndex={nextCareer.fundIndex}
            role={copy.lockedRole}
            roleTrend={null}
            fund="$0"
            fundTrend={null}
            trust="0"
            trustTrendValue={null}
          />
        )}
        {!stay.allowed && (
          <p className="rehire-locked">
            {stay.folded ? copy.stayFolded.replace('{firm}', stay.firmName) : copy.stayLocked}
          </p>
        )}
        {stay.forgiven && <p className="rehire-forgiven">{copy.stayForgiven}</p>}
      </section>

      {/* New firm: a sealed envelope. Only the possible range, in a
          sentence (no per-offer fields); "Take new job" opens the letters. */}
      <section className="rehire-block rehire-outside">
        <h3 className="rehire-block-title">
          {copy.outsideTitle.replace('{n}', String(offers?.length ?? out.lpOffers ?? '')).trim()}
        </h3>
        {out.lpOffers ? (
          <p className="rehire-sealed">
            {fill(copy.sealedLp, {
              n: String(out.lpOffers),
              lo: fmtM(out.fundLowM),
              hi: fmtM(out.fundHighM),
            })}
          </p>
        ) : (
          <p className="rehire-sealed">
            {fill(copy.sealedIntro, { n: String(offers?.length ?? 3) })}{' '}
            {fill(copy.sealedRange, {
              lo: fmtM(out.fundLowM),
              hi: fmtM(out.fundHighM),
              tlo: String(Math.round(out.trustLow)),
              thi: String(Math.round(out.trustHigh)),
            })}{' '}
            {fill(
              out.tierLow === game.tier && out.tierHigh === game.tier
                ? copy.sealedRoleSame
                : copy.sealedRole,
              {
                role:
                  out.tierLow === out.tierHigh
                    ? TIER_LABELS[out.tierHigh]
                    : `${TIER_LABELS[out.tierLow]} or ${TIER_LABELS[out.tierHigh]}`,
              },
            )}
          </p>
        )}
        <p className="rehire-sealed-note">{copy.sealedNote}</p>
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
