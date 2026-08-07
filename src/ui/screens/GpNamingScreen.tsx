import { useState } from 'react';
import type { CareerState } from '../../game/types';
import { fmtM } from '../format';

/** GP vanity screen: name the firm, or keep rerolling generated names. */
export function GpNamingScreen({
  career,
  suggest,
  onDone,
}: {
  career: CareerState;
  /** Produces a fresh generated firm name (engine generator, UI seed). */
  suggest: () => string;
  onDone: (name: string) => void;
}): JSX.Element {
  const [suggestion, setSuggestion] = useState(suggest);
  const [typed, setTyped] = useState('');
  const finalName = typed.trim() || suggestion;
  const fund = career.pendingFund;

  return (
    <section className="screen letterhead">
      <div className="letterhead-rule">Articles of incorporation</div>
      <p className="letterhead-kicker">
        Fund {career.fundIndex} &middot; {fund ? fmtM(fund.sizeM) : ''} committed
      </p>
      <h1 className="letterhead-title naming-preview">{finalName}</h1>
      <label className="naming-field">
        <span className="fig-label">NAME YOUR FIRM (OR DON&apos;T)</span>
        <input
          type="text"
          className="naming-input"
          value={typed}
          maxLength={40}
          placeholder={suggestion}
          onChange={(e) => setTyped(e.target.value)}
        />
      </label>
      <div className="screen-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setTyped('');
            setSuggestion(suggest());
          }}
        >
          Reroll a name
        </button>
        <button type="button" className="btn btn-sign" onClick={() => onDone(finalName)}>
          Sign the papers
        </button>
      </div>
    </section>
  );
}
