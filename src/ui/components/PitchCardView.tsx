import type { PitchCard } from '../../game/types';
import { fmtArrK, fmtM, STAGE_LABELS } from '../format';

function Pips({ label, value, hot }: { label: string; value: number; hot?: boolean }): JSX.Element {
  return (
    <div className="pips-row">
      <span className="pips-label">{label}</span>
      <span className={`pips ${hot ? 'pips-hot' : ''}`} aria-label={`${label} ${value} of 5`}>
        {Array.from({ length: 5 }, (_, i) => (i < value ? '●' : '○')).join('')}
      </span>
    </div>
  );
}

/** The deal-memo pitch card face. Pure presentation. */
export function PitchCardView({
  card,
  memoNumber,
  nameFont,
}: {
  card: PitchCard;
  memoNumber: number;
  /** Font id for the company name (see ui/fonts/cardFonts.ts). */
  nameFont?: string;
}): JSX.Element {
  return (
    <div className="pitch-card">
      {card.onThesis && <span className="thesis-tab">ON-THESIS</span>}
      <div className="pitch-head">
        <span>{card.sector.toUpperCase()}</span>
        <span>{STAGE_LABELS[card.stage]}</span>
      </div>
      <h2 className="pitch-name" data-font={nameFont}>
        {card.name}
      </h2>
      <p className="pitch-idea">&ldquo;{card.idea}&rdquo;</p>
      <div className="pitch-stats">
        <Pips label="TEAM" value={card.team} />
        <Pips label="TRACTION" value={card.traction} />
        <Pips label="DEAL HEAT" value={card.heat} hot />
      </div>
      <div className="pitch-figures">
        <div>
          <span className="fig-label">ARR</span>
          <span className="fig-value">{fmtArrK(card.arrK)}</span>
        </div>
        <div>
          <span className="fig-label">ASK</span>
          <span className="fig-value">{fmtM(card.askM)}</span>
        </div>
        <div>
          <span className="fig-label">PRE-MONEY</span>
          <span className="fig-value">{fmtM(card.valuationM)}</span>
        </div>
      </div>
      <div className="pitch-foot">DEAL MEMO No. {String(memoNumber).padStart(3, '0')}</div>
    </div>
  );
}
