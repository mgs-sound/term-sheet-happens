import { useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { CareerState } from '../../game/types';
import { ProfileHead } from '../components/ProfileHead';
import { fillLine, fmtM, pickLine } from '../format';

/** How many skills the blank profile lists (picked from the pool). */
const ONBOARDING_SKILLS = 3;

/**
 * A new career starts here: a blank, faintly tragic professional profile.
 * The name is optional (tap it to change it); "Start using Term Sheet
 * Happens" goes straight to the job offers (the engagement letters).
 * Same layout as the career profile it will grow into.
 */
export function OnboardingScreen({
  career,
  lines,
  seed,
  onSearch,
  onSettings,
}: {
  career: CareerState;
  lines: FlavorLines;
  /** Picks this career's blurb, skills and endorsement (presentation only). */
  seed: number;
  /** Commit the name and open the job offers. */
  onSearch: (name: string) => void;
  onSettings: () => void;
}): JSX.Element {
  const copy = lines.profile;
  const ob = copy.onboarding;
  // An heir (the succession letter's hand-over) gets the family-business pools.
  const heir = career.heirOf;
  const heirVars = heir
    ? {
        grandparent: heir.name,
        funds: String(heir.funds),
        years: String(heir.years),
        returned: fmtM(heir.returnedM),
      }
    : null;
  const pools = heir ? lines.legacy.heir : ob;
  const [name, setName] = useState(career.playerName ?? ob.defaultName);
  const shownName = name.trim();
  const about = fillLine(pickLine(pools.about, seed), heirVars ?? {});
  // ONBOARDING_SKILLS distinct skills from the pool, starting at a seeded spot.
  const skills = Array.from(
    { length: Math.min(ONBOARDING_SKILLS, pools.skills.length) },
    (_, i) => pools.skills[(Math.abs(seed) + i * 5) % pools.skills.length]!,
  ).filter((s, i, all) => all.indexOf(s) === i);
  const endorsed = heirVars
    ? fillLine(pickLine(lines.legacy.heir.endorsedNamed, seed), heirVars)
    : shownName
      ? pickLine(ob.endorsedNamed, seed).replace('{name}', shownName)
      : pickLine(ob.endorsedAnon, seed);

  return (
    <section className="screen letterhead ledger-screen profile-screen onboarding-screen">
      <div className="letterhead-rule">{copy.title}</div>

      <ProfileHead name={name} placeholder={ob.defaultName} onNameChange={setName} />
      <span className="harvest-label label-red profile-badge">{copy.openToWork}</span>

      <p className="profile-summary">{about}</p>

      <h2 className="profile-section">{copy.skillsTitle}</h2>
      <ul className="profile-skills">
        {skills.map((s) => (
          <li key={s} className="profile-skill">
            {s}
          </li>
        ))}
      </ul>
      <p className="profile-endorsed">{endorsed}</p>

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
