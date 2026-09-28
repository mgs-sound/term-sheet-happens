import { useEffect, useRef, useState } from 'react';
import type { Action, GameState } from '../../game/types';
import type { FlavorLines } from '../../content/types';
import { offerBounds } from '../../game/negotiation';
import { SWIPE } from '../../game/tuning';
import { services } from '../../services';
import { fmtM } from '../format';
import { useReducedMotion } from '../useReducedMotion';
import { applyDrag, showStamp, springBack } from '../gesture/cardVisual';
import { useColumnSwipe, type SwipeDir } from '../gesture/useColumnSwipe';
import { LedgerBar } from '../components/LedgerBar';
import { PitchCardView } from '../components/PitchCardView';
import { SwipeShell } from '../components/SwipeShell';
import { InterruptCard } from '../components/InterruptCard';
import { SignSheet } from '../components/SignSheet';

const FLY_MS = 320;

/**
 * The swipe loop. Horizontal swipes work from ANYWHERE in the column —
 * ledger, card, or buttons — via container-level pointer handling; buttons
 * still take clean taps thanks to slop-based disambiguation. Every mutation
 * is a dispatched engine action.
 */
export function RunScreen({
  game,
  dispatch,
  lines,
  onBlockedSwipe,
}: {
  game: GameState;
  dispatch: (action: Action) => GameState;
  lines: FlavorLines;
  onBlockedSwipe: () => void;
}): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [exiting, setExiting] = useState<SwipeDir | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const advanceTimer = useRef<number | null>(null);
  const screenRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tintLeftRef = useRef<HTMLSpanElement>(null);
  const tintRightRef = useRef<HTMLSpanElement>(null);

  const card = game.currentCard;
  const busy = exiting !== null || advanceTimer.current !== null;
  // Last card seen, so the hidden dock buttons keep a realistic label (and
  // therefore height) during interrupts / between cards.
  const lastCardRef = useRef(card);
  if (card) lastCardRef.current = card;
  const labelCard = card ?? lastCardRef.current;
  const actionsActive = card !== null && game.phase === 'meeting' && !sheetOpen;

  const commitDistancePx = (): number =>
    (screenRef.current?.clientWidth ?? 390) * SWIPE.commitDistanceRatio;

  const setTints = (dx: number): void => {
    const progress = dx === 0 ? 0 : Math.min(1, Math.abs(dx) / commitDistancePx());
    if (tintLeftRef.current) tintLeftRef.current.style.opacity = String(dx < 0 ? progress : 0);
    if (tintRightRef.current) tintRightRef.current.style.opacity = String(dx > 0 ? progress : 0);
  };

  const flyOut = (dir: SwipeDir): void => {
    setExiting(dir);
    advanceTimer.current = window.setTimeout(
      () => {
        advanceTimer.current = null;
        setExiting(null);
        dispatch({ type: 'ADVANCE' });
      },
      reducedMotion ? 40 : FLY_MS,
    );
  };

  /** Close the sheet and animate by however the engine resolved the card. */
  const finishFromResolution = (state: GameState): void => {
    setSheetOpen(false);
    const res = state.resolution;
    if (!res) return;
    flyOut(res === 'signed' || res === 'vetoed' ? 'right' : 'left');
  };

  const commit = (dir: SwipeDir): void => {
    if (!card || busy || sheetOpen) return;
    setTints(0);
    if (cardRef.current) showStamp(cardRef.current, dir);
    void services.haptics.tap(); // on commit only, never on drag start
    if (dir === 'left') {
      dispatch({ type: 'PASS' });
      flyOut('left');
      return;
    }
    if (game.isFundI) {
      finishFromResolution(dispatch({ type: 'SIGN_AT_ASK' }));
    } else {
      setSheetOpen(true); // terms sheet decides; no engine action yet
    }
  };

  const canSwipe = (dir: SwipeDir): boolean => {
    if (!card || sheetOpen) return false;
    if (dir === 'right') {
      const minNeededM = game.isFundI ? card.askM : Math.min(card.askM, offerBounds(card).checkMinM);
      if (minNeededM > game.capitalM) {
        onBlockedSwipe();
        return false;
      }
    }
    return true;
  };

  // Modals (sheet, interrupts) own their gestures; the column swipe is off.
  const gestureEnabled = (): boolean =>
    card !== null &&
    game.phase === 'meeting' &&
    game.resolution === null &&
    !sheetOpen &&
    exiting === null &&
    advanceTimer.current === null;

  const swipe = useColumnSwipe({
    enabled: gestureEnabled,
    getCommitDistancePx: commitDistancePx,
    canSwipe,
    onDrag: (dx) => {
      if (cardRef.current) applyDrag(cardRef.current, dx, commitDistancePx());
      setTints(dx);
    },
    onRelease: () => {
      if (cardRef.current) springBack(cardRef.current);
      setTints(0);
    },
    onCommit: commit,
  });

  // Keyboard parity: ArrowLeft = pass, ArrowRight = sign, same stamp beat.
  const keyRefs = useRef({ commit, canSwipe, gestureEnabled });
  keyRefs.current = { commit, canSwipe, gestureEnabled };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      const { commit: doCommit, canSwipe: may, gestureEnabled: on } = keyRefs.current;
      if (!on()) return;
      const dir: SwipeDir = e.key === 'ArrowLeft' ? 'left' : 'right';
      if (!may(dir)) return;
      e.preventDefault();
      doCommit(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="screen run-screen" ref={screenRef} {...swipe}>
      <LedgerBar game={game} stageLabels={lines.reputationStages} />

      <div className="card-arena">
        {game.phase === 'interrupt' && game.interrupt ? (
          <InterruptCard
            event={game.interrupt}
            game={game}
            onResolve={(accept) => {
              void services.haptics.tap();
              dispatch({ type: 'RESOLVE_INTERRUPT', accept });
            }}
          />
        ) : card ? (
          <SwipeShell
            key={`${card.pitchId}-${game.meetingIndex}`}
            ref={cardRef}
            exiting={exiting}
            stampLeft="PASS"
            stampRight="OFFER"
          >
            <PitchCardView card={card} memoNumber={game.meetingIndex + 1} />
          </SwipeShell>
        ) : (
          <div className="arena-empty">No founders left in the lobby.</div>
        )}
        {sheetOpen && card && (
          <SignSheet
            key={card.pitchId}
            card={card}
            game={game}
            lines={lines}
            onCancel={() => {
              if (game.phase === 'meeting') setSheetOpen(false);
            }}
            onSignAtAsk={(boardSeat) => {
              void services.haptics.tap();
              finishFromResolution(dispatch({ type: 'SIGN_AT_ASK', boardSeat }));
            }}
            onNegotiate={() => {
              dispatch({ type: 'OPEN_NEGOTIATION' });
            }}
            onSendOffer={(offer) => {
              const next = dispatch({ type: 'SEND_OFFER', ...offer });
              if (next.phase !== 'negotiation') {
                void services.haptics.tap();
                finishFromResolution(next);
              }
            }}
            onWalk={() => finishFromResolution(dispatch({ type: 'WALK_AWAY' }))}
          />
        )}
      </div>

      {/* The buttons are ALWAYS laid out and only hidden (visibility) when
          inactive, so the dock keeps their exact height — even when a long
          label wraps — and the card never shifts as they come and go. */}
      <div className="action-dock">
        {labelCard && (
          <div
            className={`swipe-actions ${actionsActive ? '' : 'is-hidden'}`}
            aria-hidden={!actionsActive}
          >
            <button
              type="button"
              className="btn btn-pass"
              disabled={!actionsActive || busy}
              onClick={() => canSwipe('left') && commit('left')}
              aria-label="Pass on this deal"
            >
              Pass
            </button>
            <button
              type="button"
              className="btn btn-sign"
              disabled={
                !actionsActive || busy || (game.isFundI && labelCard.askM > game.capitalM)
              }
              onClick={() => canSwipe('right') && commit('right')}
              aria-label={
                game.isFundI
                  ? `Sign at ask, ${fmtM(labelCard.askM)}`
                  : `Draft terms for ${labelCard.name}`
              }
            >
              {game.isFundI ? (
                <>Sign at ask &middot; {fmtM(labelCard.askM)}</>
              ) : (
                <>Draft terms &middot; {fmtM(labelCard.askM)} ask</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Directional color wash at the column edges during drags. */}
      <span ref={tintLeftRef} className="swipe-tint tint-left" aria-hidden="true" />
      <span ref={tintRightRef} className="swipe-tint tint-right" aria-hidden="true" />
    </section>
  );
}
