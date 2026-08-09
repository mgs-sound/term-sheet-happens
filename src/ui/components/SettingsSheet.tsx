import { useMemo, useState } from 'react';
import blocklistJson from '../../content/name-blocklist.json';
import { createNameFilter } from '../../content/nameFilter';
import type { CareerState } from '../../game/types';
import { LEADERBOARD } from '../../game/tuning';

/** Settings overlay: register identity + the resignation letter. */
export function SettingsSheet({
  career,
  onUpdateCareer,
  onClose,
  onResetCareer,
}: {
  career: CareerState;
  onUpdateCareer: (career: CareerState) => void;
  onClose: () => void;
  onResetCareer: () => void;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const [nameDraft, setNameDraft] = useState(career.playerName ?? '');
  const filter = useMemo(() => createNameFilter(blocklistJson.blocklist), []);
  const cleanDraft = filter.clean(nameDraft, LEADERBOARD.nameMinLen, LEADERBOARD.nameMaxLen);

  return (
    <div className="settings-backdrop" role="dialog" aria-label="Settings">
      <div className="settings-panel">
        <div className="letterhead-rule">Settings</div>
        {!confirming ? (
          <>
            {career.playerName !== null ? (
              <label className="naming-field">
                <span className="fig-label">REGISTER NAME</span>
                <input
                  type="text"
                  className="naming-input carve-input"
                  value={nameDraft}
                  maxLength={LEADERBOARD.nameMaxLen}
                  onChange={(e) => setNameDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={cleanDraft === null || cleanDraft === career.playerName}
                  onClick={() => cleanDraft && onUpdateCareer({ ...career, playerName: cleanDraft })}
                >
                  Update the name
                </button>
              </label>
            ) : career.boardOptIn === false ? (
              <>
                <p className="settings-note">
                  This fund is private. The register holds no grudge.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onUpdateCareer({ ...career, boardOptIn: null })}
                >
                  Rejoin the register
                </button>
              </>
            ) : (
              <p className="settings-note">
                The register will ask for your name after your next fund closes.
              </p>
            )}
            <p className="settings-note">
              Progress autosaves after every meeting and every fund close.
            </p>
            <button type="button" className="btn btn-pass" onClick={() => setConfirming(true)}>
              Leave the industry
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Back to work
            </button>
          </>
        ) : (
          <>
            <p className="settings-note settings-warning">
              Your career, ledger, and every fund on it will be forgotten. The
              industry already has.
            </p>
            <button type="button" className="btn btn-pass" onClick={onResetCareer}>
              Sign the resignation
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirming(false)}
            >
              Never mind
            </button>
          </>
        )}
      </div>
    </div>
  );
}
