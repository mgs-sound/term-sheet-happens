import { useMemo, useState } from 'react';
import blocklistJson from '../../content/name-blocklist.json';
import { createNameFilter } from '../../content/nameFilter';
import { LEADERBOARD } from '../../game/tuning';

/**
 * Arcade name entry, memo style: shown once per career after its first fund
 * closes. Declining is permanent for the career (re-offerable in settings).
 */
export function NameCarveSheet({
  onCarve,
  onDecline,
}: {
  onCarve: (name: string) => void;
  onDecline: () => void;
}): JSX.Element {
  const [raw, setRaw] = useState('');
  const filter = useMemo(() => createNameFilter(blocklistJson.blocklist), []);
  const clean = filter.clean(raw, LEADERBOARD.nameMinLen, LEADERBOARD.nameMaxLen);
  const showRejection = raw.trim().length >= LEADERBOARD.nameMinLen && clean === null;

  return (
    <div className="settings-backdrop" role="dialog" aria-label="Carve your name">
      <div className="settings-panel">
        <div className="letterhead-rule">The LP register</div>
        <p className="carve-title">CARVE YOUR NAME INTO THE LEDGER</p>
        <p className="settings-note">
          Your career&rsquo;s returns, ranked against every other GP. Optional, public,
          and mildly humiliating either way.
        </p>
        <input
          type="text"
          className="naming-input carve-input"
          value={raw}
          maxLength={LEADERBOARD.nameMaxLen}
          placeholder="e.g. DPI DEMON"
          onChange={(e) => setRaw(e.target.value)}
          aria-label={`Register name, ${LEADERBOARD.nameMinLen} to ${LEADERBOARD.nameMaxLen} characters`}
        />
        {showRejection && (
          <p className="settings-note settings-warning">The register keeps a family ledger.</p>
        )}
        <button
          type="button"
          className="btn btn-sign"
          disabled={clean === null}
          onClick={() => clean && onCarve(clean)}
        >
          Carve it
        </button>
        <button type="button" className="btn btn-text" onClick={onDecline}>
          Keep my fund private
        </button>
      </div>
    </div>
  );
}
