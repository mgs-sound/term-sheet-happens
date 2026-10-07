import { useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { GameState, PitchCard } from '../../game/types';
import { acceptanceProbability, offerBounds } from '../../game/negotiation';
import { ownershipFromCheck } from '../../game/followons';
import { fmtM, pickLine } from '../format';
import { services } from '../../services';
import { BOARD_SEATS } from '../../game/tuning';

/** "+25% on exits, −25% if it dies": the seat's harvest risk, spelled out. */
function seatNote(lines: FlavorLines): string {
  return lines.boardSeat.note
    .replace('{bonus}', String(Math.round((BOARD_SEATS.exitMult - 1) * 100)))
    .replace('{penalty}', String(Math.round(BOARD_SEATS.zeroPenalty * 100)));
}

export interface OfferDraft {
  checkM: number;
  valuationM: number;
  boardSeat: boolean;
}

/**
 * The swipe-right sheet (Fund II+): SIGN AT ASK vs NEGOTIATE, then the
 * negotiation stage with check + valuation sliders, implied ownership,
 * founder-mood hint, and the counter round. All numbers come from engine
 * functions — the UI computes nothing itself.
 */
export function SignSheet({
  card,
  game,
  lines,
  onCancel,
  onSignAtAsk,
  onNegotiate,
  onSendOffer,
  onWalk,
}: {
  card: PitchCard;
  game: GameState;
  lines: FlavorLines;
  onCancel: () => void;
  onSignAtAsk: (boardSeat: boolean) => void;
  onNegotiate: () => void;
  onSendOffer: (offer: OfferDraft) => void;
  onWalk: () => void;
}): JSX.Element {
  const negotiating = game.phase === 'negotiation';
  const negotiation = game.negotiation;
  const bounds = offerBounds(card);
  const checkMaxM = Math.min(bounds.checkMaxM, game.capitalM);
  const canNegotiate = checkMaxM >= bounds.checkMinM;
  const seatAvailable = game.tier === 'partner' || game.tier === 'gp';

  const [boardSeat, setBoardSeat] = useState(false);
  const [checkM, setCheckM] = useState(() => Math.min(card.askM, checkMaxM));
  const [valuationM, setValuationM] = useState(card.valuationM);

  const offer: OfferDraft = { checkM, valuationM, boardSeat };
  const round = negotiation?.round ?? 0;
  const p = acceptanceProbability(card, offer, round);
  const moodIdx = Math.min(
    lines.founderMoods.length - 1,
    Math.floor(p * lines.founderMoods.length),
  );
  const counter = negotiation?.counter ?? null;
  const canMeetCounter = counter !== null && counter.checkM <= checkMaxM;

  return (
    <div className="sheet" role="dialog" aria-label={`Terms for ${card.name}`}>
      <div className="sheet-head">
        <span>{card.name}</span>
        <span className="sheet-ask">
          asks {fmtM(card.askM)} at {fmtM(card.valuationM)} pre
        </span>
      </div>

      {!negotiating ? (
        <>
          <div className="seat-row">
            {seatAvailable ? (
              <label className="seat-label">
                <input
                  type="checkbox"
                  checked={boardSeat}
                  onChange={(e) => setBoardSeat(e.target.checked)}
                />
                {lines.boardSeat.label} <span className="seat-note">({seatNote(lines)})</span>
              </label>
            ) : (
              <p className="seat-locked">{pickLine(lines.boardSeatLocked, game.seed)}</p>
            )}
          </div>
          <div className="sheet-actions">
            <button type="button" className="btn btn-text" data-sfx="close" onClick={onCancel}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-sfx="draft"
              disabled={!canNegotiate}
              onClick={onNegotiate}
            >
              Negotiate
            </button>
            <button
              type="button"
              className="btn btn-sign"
              data-sfx="none"
              disabled={card.askM > game.capitalM}
              onClick={() => onSignAtAsk(boardSeat)}
            >
              Sign at ask
            </button>
          </div>
          {!canNegotiate && (
            <p className="sheet-note">Not enough dry powder to even open negotiations.</p>
          )}
        </>
      ) : (
        <>
          <label className="slider-row">
            <span className="slider-label">
              Check <strong>{fmtM(checkM)}</strong>
            </span>
            <input
              type="range"
              min={bounds.checkMinM}
              max={checkMaxM}
              step={0.1}
              value={checkM}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCheckM(v);
                services.audio.slide((v - bounds.checkMinM) / Math.max(0.0001, checkMaxM - bounds.checkMinM));
              }}
              aria-label="Check size"
            />
          </label>
          <label className="slider-row">
            <span className="slider-label">
              Valuation <strong>{fmtM(valuationM)}</strong> pre
            </span>
            <input
              type="range"
              min={bounds.valMinM}
              max={bounds.valMaxM}
              step={0.1}
              value={valuationM}
              onChange={(e) => {
                const v = Number(e.target.value);
                setValuationM(v);
                services.audio.slide((v - bounds.valMinM) / Math.max(0.0001, bounds.valMaxM - bounds.valMinM));
              }}
              aria-label="Pre-money valuation"
            />
          </label>

          <div className="nego-readout">
            <span>
              Implied ownership{' '}
              <strong className="mono">{(ownershipFromCheck(checkM, valuationM) * 100).toFixed(1)}%</strong>
            </span>
            <span>
              Founder: <em>{lines.founderMoods[moodIdx]}</em>
            </span>
          </div>

          {/* Board seat stays negotiable every round (the engine takes it per
              offer, and the founder mood above already prices it in) — e.g.
              drop the seat on the final round to land the deal. */}
          {seatAvailable && (
            <div className="seat-row">
              <label className="seat-label">
                <input
                  type="checkbox"
                  checked={boardSeat}
                  onChange={(e) => setBoardSeat(e.target.checked)}
                />
                {lines.boardSeat.label} <span className="seat-note">({seatNote(lines)})</span>
              </label>
            </div>
          )}

          {counter && (
            <div className="counter-block">
              <span>
                Counter: {fmtM(counter.checkM)} at {fmtM(counter.valuationM)} pre. Final round.
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                data-sfx="meetCounter"
                disabled={!canMeetCounter}
                onClick={() => {
                  setCheckM(Math.min(counter.checkM, checkMaxM));
                  setValuationM(Math.min(counter.valuationM, bounds.valMaxM));
                }}
              >
                Meet it
              </button>
            </div>
          )}

          <div className="sheet-actions">
            <button type="button" className="btn btn-pass" data-sfx="none" onClick={onWalk}>
              Walk away
            </button>
            <button type="button" className="btn btn-sign" data-sfx="none" onClick={() => onSendOffer(offer)}>
              {round === 0 ? 'Send the offer' : 'Final offer'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
