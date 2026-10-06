import { useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { CareerState } from '../../game/types';
import { ProfileHead } from '../components/ProfileHead';

/**
 * A new career starts here: a blank, faintly tragic professional profile.
 * The name is optional (tap it to change it); "Start using Term Sheet
 * Happens" goes straight to the job offers (the engagement letters).
 * Same layout as the career profile it will grow into.
 */
export function OnboardingScreen({
  career,
  lines,
  onSearch,
  onSettings,
}: {
  career: CareerState;
  lines: FlavorLines;
  /** Commit the name and open the job offers. */
  onSearch: (name: string) => void;
  onSettings: () => void;
}): JSX.Element {
  const copy = lines.profile;
  const ob = copy.onboarding;
  const [name, setName] = useState(career.playerName ?? ob.defaultName);
  const shownName = name.trim();

  return (
    <section className="screen letterhead ledger-screen profile-screen onboarding-screen">
      <div className="letterhead-rule">{copy.title}</div>

      <ProfileHead name={name} placeholder={ob.defaultName} onNameChange={setName} />
      <span className="harvest-label label-red profile-badge">{copy.openToWork}</span>

      <p className="profile-summary">{ob.about}</p>

      <h2 className="profile-section">{copy.skillsTitle}</h2>
      <ul className="profile-skills">
        {ob.skills.map((s) => (
          <li key={s} className="profile-skill">
            {s}
          </li>
        ))}
      </ul>
      <p className="profile-endorsed">
        {shownName ? ob.endorsedNamed.replace('{name}', shownName) : ob.endorsedAnon}
      </p>

      {/* Sits a little above the bottom: more room above it than below. */}
      <div className="onboarding-spacer onboarding-spacer-top" />
      <button
        type="button"
        className="btn btn-sign onboarding-cta onboarding-start"
        data-sfx="start"
        onClick={() => onSearch(shownName || ob.defaultName)}
      >
        {ob.startCta}
      </button>
      <div className="onboarding-spacer" />

      <div className="screen-actions">
        <button type="button" className="btn btn-text" data-sfx="open" onClick={onSettings}>
          Settings
        </button>
      </div>
    </section>
  );
}
