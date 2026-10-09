import type { FlavorLines } from '../../content/types';
import { LP_REQUESTS } from '../../game/tuning';
import type { LpRequest } from '../../game/types';
import { requestThresholds } from '../../game/lpRequests';

/** The request's copy, with its tuning numbers filled in. */
export function lpRequestText(lines: FlavorLines, r: LpRequest): string {
  const pool = lines.lpRequests.kinds[r.kind];
  const text = pool[r.lineIndex % pool.length] ?? '';
  const t = requestThresholds(r);
  const deployed = Math.round(t.dryPowderMaxDeployed * 100);
  return text
    .replace('{pct}', String(100 - deployed))
    .replace('{deployed}', String(deployed))
    .replace('{n}', String(t.diversifyMinOffThesis))
    .replace('{heat}', String(t.coolDealsMaxHeat))
    .replace('{team}', String(t.reliableTeamsMinTeam))
    .replace('{x}', String(r.target ?? LP_REQUESTS.returnFundDpi));
}

/**
 * The fund's LP requests as a sign-here checklist (yellow highlight rows).
 * Open = empty box; broken = struck through with a red ✗; met = green ✓.
 * `stamps` adds the MET / BROKEN stamp per row (scorecard).
 */
export function LpRequestList({
  requests,
  lines,
  stamps = false,
  note = false,
  forgiven = false,
  folded = false,
  compact = false,
}: {
  requests: LpRequest[] | undefined;
  lines: FlavorLines;
  stamps?: boolean;
  /** Show the reward note (engagement letter). */
  note?: boolean;
  /** Scorecard: missed requests were forgiven by a strong DPI. */
  forgiven?: boolean;
  /** Scorecard: the DPI was so bad the firm folds, whatever the requests. */
  folded?: boolean;
  /** Small, for the run screen (always in view while playing). */
  compact?: boolean;
}): JSX.Element | null {
  if (!requests || requests.length === 0) return null;
  const copy = lines.lpRequests;
  return (
    <section className={`lp-requests ${compact ? 'lp-requests-compact' : ''}`} aria-label={copy.title}>
      <h2 className="lp-requests-title">{copy.title}</h2>
      <ul className="lp-requests-list">
        {requests.map((r) => (
          <li key={r.kind} className={`lp-request lp-request-${r.status}`}>
            {/* Still open: a plain bullet, not an empty box (it isn't tappable).
                Settled: a ✓ / ✗ mark. */}
            <span
              className={`lp-request-box ${r.status === 'open' ? 'is-bullet' : ''}`}
              aria-hidden="true"
            >
              {r.status === 'met' ? '✓' : r.status === 'broken' ? '✗' : '•'}
            </span>
            <span className="lp-request-text">{lpRequestText(lines, r)}</span>
            {stamps && r.status !== 'open' && (
              <span className={`harvest-label lp-request-stamp ${r.status === 'met' ? 'label-green' : 'label-red'}`}>
                {r.status === 'met'
                  ? copy.stampMet
                  : r.reason === 'noDeals'
                    ? copy.stampNoDeals
                    : copy.stampBroken}
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* Scorecard: what the requests mean for your job (stay vs. leave). */}
      {stamps && requests.every((r) => r.status !== 'open') && (
        <p
          className={`lp-requests-verdict ${
            !folded && (requests.every((r) => r.status === 'met') || forgiven)
              ? 'is-met'
              : 'is-missed'
          }`}
        >
          {folded
            ? copy.verdictFolded
            : requests.every((r) => r.status === 'met')
            ? copy.verdictAllMet
            : forgiven
              ? copy.verdictForgiven
              : copy.verdictMissed}
        </p>
      )}
      {stamps && requests.some((r) => r.reason === 'noDeals') && (
        <p className="lp-requests-note">{copy.noDealsNote}</p>
      )}
      {note && (
        <p className="lp-requests-note">
          {copy.rewardNote.replace('{trust}', String(LP_REQUESTS.metTrustDelta))}
        </p>
      )}
    </section>
  );
}
