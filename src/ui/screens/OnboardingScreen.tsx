import { useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { CareerState } from '../../game/types';
import { ProfileHead } from '../components/ProfileHead';

/**
 * A new career starts here: a blank, faintly tragic professional profile.
 * The name is optional (tap it to type one); "Search for a job" opens the
 * job board. Same layout as the career profile it will grow into.
 */
export function OnboardingScreen({
  career,
  lines,
  onSearch,
  onSettings,
}: {
  career: CareerState;
  lines: FlavorLines;
  /** Commit the (possibly blank) name and open the job board. */
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

      <div className="onboarding-spacer" />

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

      <div className="screen-actions">
        <button
          type="button"
          className="btn btn-sign"
          data-sfx="start"
          onClick={() => onSearch(shownName || ob.defaultName)}
        >
          {ob.cta}
        </button>
        <button type="button" className="btn btn-text" data-sfx="open" onClick={onSettings}>
          Settings
        </button>
      </div>
    </section>
  );
}
