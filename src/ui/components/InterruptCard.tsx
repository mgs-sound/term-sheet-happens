import type { GameState, InterruptEvent } from '../../game/types';
import { fmtM } from '../format';

/**
 * Interrupt cards (Fund II+): follow-on raises, bridges, capital calls.
 * Button-driven decisions; RESOLVE_INTERRUPT is the only mutation.
 */
export function InterruptCard({
  event,
  game,
  companyFont,
  onResolve,
}: {
  event: InterruptEvent;
  game: GameState;
  /** Font id the company had on its pitch card (see ui/fonts/cardFonts.ts). */
  companyFont?: string;
  onResolve: (accept: boolean) => void;
}): JSX.Element {
  // The company name keeps its own face and casing inside the caps headline,
  // like a logo dropped into a newspaper head.
  const company = (name: string): JSX.Element => (
    <span className="interrupt-company" data-font={companyFont}>
      {name}
    </span>
  );

  if (event.kind === 'followOn') {
    const affordable = event.proRataCostM <= game.capitalM;
    return (
      <div className="pitch-card interrupt-card">
        <span className="urgent-tab">URGENT MEMO</span>
        <div className="pitch-head pitch-head-urgent">
          <span>PORTFOLIO</span>
          <span>FOLLOW-ON</span>
        </div>
        <h2 className="pitch-name">{company(event.companyName)} IS RAISING AGAIN</h2>
        <p className="pitch-idea">
          {fmtM(event.raiseM)} at {fmtM(event.newPreM)} pre. Your pro rata:{' '}
          <strong>{fmtM(event.proRataCostM)}</strong>. Wire it or shrink.
        </p>
        <div className="interrupt-actions">
          <button type="button" className="btn btn-pass" onClick={() => onResolve(false)}>
            Get diluted
          </button>
          <button
            type="button"
            className="btn btn-sign"
            disabled={!affordable}
            onClick={() => onResolve(true)}
          >
            Wire pro rata
          </button>
        </div>
        {!affordable && <p className="interrupt-note">Reserves are dry. Dilution it is.</p>}
      </div>
    );
  }

  if (event.kind === 'bridge') {
    const affordable = event.costM <= game.capitalM;
    return (
      <div className="pitch-card interrupt-card">
        <span className="urgent-tab">URGENT MEMO</span>
        <div className="pitch-head pitch-head-urgent">
          <span>PORTFOLIO</span>
          <span>BRIDGE</span>
        </div>
        <h2 className="pitch-name">{company(event.companyName)} NEEDS A BRIDGE</h2>
        <p className="pitch-idea">
          Needs a {fmtM(event.costM)} bridge to make payroll. Without it, the lights go out.
        </p>
        <div className="interrupt-actions">
          <button type="button" className="btn btn-pass" onClick={() => onResolve(false)}>
            Let it die
          </button>
          <button
            type="button"
            className="btn btn-sign"
            disabled={!affordable}
            onClick={() => onResolve(true)}
          >
            Wire the bridge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pitch-card interrupt-card">
      <span className="urgent-tab">URGENT MEMO</span>
      <div className="pitch-head pitch-head-urgent">
        <span>LP DESK</span>
        <span>CAPITAL CALL</span>
      </div>
      <h2 className="pitch-name">AN LP IS SLOW-WALKING {fmtM(event.amountM)}</h2>
      <p className="pitch-idea">Press them and keep the capital, or eat the shortfall quietly.</p>
      <div className="interrupt-actions">
        <button type="button" className="btn btn-pass" onClick={() => onResolve(false)}>
          Eat it
        </button>
        <button type="button" className="btn btn-sign" onClick={() => onResolve(true)}>
          Press them
        </button>
      </div>
    </div>
  );
}
