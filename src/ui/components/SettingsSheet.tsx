import { useState } from 'react';

/** Settings overlay. One setting that matters: the resignation letter. */
export function SettingsSheet({
  onClose,
  onResetCareer,
}: {
  onClose: () => void;
  onResetCareer: () => void;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="settings-backdrop" role="dialog" aria-label="Settings">
      <div className="settings-panel">
        <div className="letterhead-rule">Settings</div>
        {!confirming ? (
          <>
            <p className="settings-note">
              Progress autosaves after every meeting and every fund close.
            </p>
            <button
              type="button"
              className="btn btn-pass"
              onClick={() => setConfirming(true)}
            >
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
