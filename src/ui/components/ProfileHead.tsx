import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PLAYER_NAME_MAX } from '../../game/career';

/** Up to two initials from the name; "VC" until there is one. */
export function initials(name: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'VC';
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Tap-to-edit name: reads as the profile's title; a tap turns it into a text
 * field (all selected, so typing replaces it). Enter or tapping away commits;
 * a blank name falls back to `fallback`.
 */
function EditableName({
  name,
  fallback,
  onChange,
}: {
  name: string;
  fallback: string;
  onChange: (name: string) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);
  const commit = (): void => {
    if (!name.trim()) onChange(fallback);
    setEditing(false);
  };
  if (!editing) {
    return (
      <button
        type="button"
        className="profile-name profile-name-edit"
        data-sfx="tick"
        aria-label={`Name: ${name}. Tap to change`}
        onClick={() => setEditing(true)}
      >
        {name}
      </button>
    );
  }
  return (
    <input
      ref={ref}
      className="profile-name profile-name-input"
      type="text"
      value={name}
      maxLength={PLAYER_NAME_MAX}
      autoComplete="off"
      enterKeyHint="done"
      aria-label="Your name"
      onChange={(e) => onChange(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/** Default profile photo: the faceless placeholder silhouette. */
function Silhouette(): JSX.Element {
  return (
    // Body: a half circle whose base spans the whole bottom edge (corner to
    // corner). Head: a circle sitting on top of it, overlapping (no neck).
    <svg className="profile-silhouette" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M0 64A32 24 0 0 1 64 64z" />
      <circle cx="32" cy="26" r="16" />
    </svg>
  );
}

/** Square ID photo; a tap flips between the silhouette and the initials. */
function Avatar({ name }: { name: string | undefined }): JSX.Element {
  const [showInitials, setShowInitials] = useState(false);
  return (
    <button
      type="button"
      className="profile-avatar"
      data-sfx="tick"
      aria-label={showInitials ? 'Show placeholder photo' : 'Show initials'}
      onClick={() => setShowInitials((v) => !v)}
    >
      {showInitials ? initials(name) : <Silhouette />}
    </button>
  );
}

/**
 * Profile header: square ID "photo" + name (+ headline / about). With
 * `onNameChange` the name is tap-to-edit (new-career onboarding).
 */
export function ProfileHead({
  name,
  placeholder,
  onNameChange,
  headline,
  about,
}: {
  name: string | undefined;
  placeholder: string;
  onNameChange?: (name: string) => void;
  headline?: ReactNode;
  about?: string;
}): JSX.Element {
  return (
    <header className="profile-head">
      <Avatar name={name} />
      <div className="profile-id">
        {onNameChange ? (
          <EditableName name={name ?? ''} fallback={placeholder} onChange={onNameChange} />
        ) : (
          <h1 className="profile-name">{name || placeholder}</h1>
        )}
        {headline && <p className="profile-headline">{headline}</p>}
        {about && <p className="profile-about">{about}</p>}
      </div>
    </header>
  );
}
