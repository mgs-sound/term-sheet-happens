import type { FlavorLines } from '../../content/types';
import { LP_REQUESTS } from '../../game/tuning';
import type { LpRequest } from '../../game/types';

/** The request's copy, with its tuning numbers filled in. */
export function lpRequestText(lines: FlavorLines, r: LpRequest): string {
  const pool = lines.lpRequests.kinds[r.kind];
  const text = pool[r.lineIndex % pool.length] ?? '';
  const deployed = Math.round(LP_REQUESTS.dryPowderMaxDeployed * 100);
  return text
    .replace('{pct}', String(100 - deployed))
    .replace('{deployed}', String(deployed))
    .replace('{n}', String(LP_REQUESTS.diversifyMinOffThesis))
    .replace('{heat}', String(LP_REQUESTS.coolDealsMaxHeat))
    .replace('{team}', String(LP_REQUESTS.reliableTeamsMinTeam));
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
}: {
  requests: LpRequest[] | undefined;
  lines: FlavorLines;
  stamps?: boolean;
  /** Show the reward note (engagement letter). */
  note?: boolean;
}): JSX.Element | null {
  if (!requests || requests.length === 0) return null;
  const copy = lines.lpRequests;
  return (
    <section className="lp-requests" aria-label={copy.title}>
      <h2 className="lp-requests-title">{copy.title}</h2>
      <ul className="lp-requests-list">
        {requests.map((r) => (
          <li key={r.kind} className={`lp-request lp-request-${r.status}`}>
            <span className="lp-request-box" aria-hidden="true">
              {r.status === 'met' ? '✓' : r.status === 'broken' ? '✗' : ''}
            </span>
            <span className="lp-request-text">{lpRequestText(lines, r)}</span>
            {stamps && r.status !== 'open' && (
              <span className={`harvest-label lp-request-stamp ${r.status === 'met' ? 'label-green' : 'label-red'}`}>
                {r.status === 'met' ? copy.stampMet : copy.stampBroken}
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* Scorecard: what the requests mean for your job (stay vs. leave). */}
      {stamps && requests.every((r) => r.status !== 'open') && (
        <p
          className={`lp-requests-verdict ${
            requests.every((r) => r.status === 'met') ? 'is-met' : 'is-missed'
          }`}
        >
          {requests.every((r) => r.status === 'met') ? copy.verdictAllMet : copy.verdictMissed}
        </p>
      )}
      {note && (
        <p className="lp-requests-note">
          {copy.rewardNote.replace('{trust}', String(LP_REQUESTS.metTrustDelta))}
        </p>
      )}
    </section>
  );
}
