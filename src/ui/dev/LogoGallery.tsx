import { useEffect, useState } from 'react';
import '../App.css';
import { loadContentAsync } from '../../content/loader';
import type { Pitch } from '../../content/types';
import logoOverridesJson from '../../content/logo-overrides.json';
import { logoSvg, type LogoOverride } from '../../game/logogen';

const OVERRIDES = logoOverridesJson.overrides as Record<string, LogoOverride>;

/** ?logos=1 (dev only): every mark in a grid — spot duds, pin overrides. */
export function LogoGallery(): JSX.Element {
  const [pitches, setPitches] = useState<Pitch[] | null>(null);
  useEffect(() => {
    void loadContentAsync().then((c) => setPitches(c.pitches));
  }, []);

  if (!pitches) return <main className="app-shell">Loading&hellip;</main>;

  return (
    <main className="logo-gallery game-surface">
      <header className="review-bar">
        <span className="review-title">LOGO GALLERY</span>
        <span className="review-progress mono">
          {pitches.length} marks &middot; pin duds in logo-overrides.json
        </span>
      </header>
      <div className="logo-grid">
        {pitches.map((p) => {
          const svg = logoSvg(p.name, p.sector, 48, OVERRIDES[p.name]);
          const frame = svg.match(/data-frame="(\w+)"/)?.[1];
          return (
            <figure key={p.id} className="logo-cell">
              <span dangerouslySetInnerHTML={{ __html: svg }} />
              <figcaption>
                <strong>{p.name}</strong>
                <span className="mono">
                  {p.sector} &middot; {frame}
                  {OVERRIDES[p.name] ? ' · pinned' : ''}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
