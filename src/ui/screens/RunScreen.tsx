import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Action, GameState } from '../../game/types';
import type { FlavorLines } from '../../content/types';
import { offerBounds } from '../../game/negotiation';
import { SWIPE } from '../../game/tuning';
import { services } from '../../services';
import { fmtM } from '../format';
import { useReducedMotion } from '../useReducedMotion';
import { applyDrag, parkOffer, showStamp, springBack } from '../gesture/cardVisual';
import { useColumnSwipe, type SwipeDir } from '../gesture/useColumnSwipe';
import { LedgerBar } from '../components/LedgerBar';
import { PitchCardView } from '../components/PitchCardView';
import { SwipeShell } from '../components/SwipeShell';
import { InterruptCard } from '../components/InterruptCard';
import { SignSheet } from '../components/SignSheet';
import {
  COIN_HOLD_MS,
  COIN_SPIN_MS,
  VetoChallengeSheet,
} from '../components/VetoChallengeSheet';
import type {
  ChallengeCall,
  CoinSide,
  DiceCall,
  HighLowCall,
  PlayingCard,
  StickCall,
} from '../../game/types';
import { DICE_ROLL_MS, DiceChallengeSheet } from '../components/DiceChallengeSheet';
import { STICKS_REVEAL_MS, SticksChallengeSheet } from '../components/SticksChallengeSheet';
import { CARD_REVEAL_MS, HighLowChallengeSheet } from '../components/HighLowChallengeSheet';
import { PortfolioSheet } from '../components/PortfolioSheet';
import { fontForCompany, fontsForDeck } from '../fonts/cardFonts';
import { reduce } from '../../game/engine';

const FLY_MS = 320;
/** Result cue lands just after the stamp cue, so the two read as cause/effect. */
const RESULT_SFX_DELAY_MS = 180;
/** Matches the .result-stamp animation-delay: the verdict stamp's thunk. */
const RESULT_STAMP_DELAY_MS = 250;
/** Breathing room (px) between the lifted card's DEAL HEAT row and the sheet. */
const LIFT_GAP_PX = 8;

/** Layout-only top of `el` within `root` (offsetTop chain — ignores the
 *  transforms used for swiping/lifting, so measuring never feeds back). */
function topWithin(el: HTMLElement, root: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y;
}

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
  onSettings,
  onPortfolioOpen,
}: {
  game: GameState;
  dispatch: (action: Action) => GameState;
  lines: FlavorLines;
  onBlockedSwipe: () => void;
  /** Opens the app-level Settings sheet (reachable from the portfolio). */
  onSettings: () => void;
  /** Portfolio opened: the run's toasts lose their context, so drop them. */
  onPortfolioOpen: () => void;
}): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [exiting, setExiting] = useState<SwipeDir | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  // Partner's challenge (coin or higher/lower): the previewed result, held on
  // screen while it plays out, before the outcome is committed and the card flies.
  type ChallengeShow =
    | { kind: 'coin'; flip: { call: CoinSide; landed: CoinSide; won: boolean } }
    | {
        kind: 'highLow';
        shown: PlayingCard;
        round: { call: HighLowCall; hidden: PlayingCard; won: boolean };
      }
    | { kind: 'dice'; roll: { call: DiceCall; roll: number; won: boolean } }
    | { kind: 'sticks'; draw: { call: StickCall; red: number; green: number; won: boolean } };
  const [challengeShow, setChallengeShow] = useState<ChallengeShow | null>(null);
  const challengeOpen = game.phase === 'vetoChallenge' || challengeShow !== null;
  const pendingChallenge = game.vetoChallenge;
  const advanceTimer = useRef<number | null>(null);
  const screenRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tintLeftRef = useRef<HTMLSpanElement>(null);
  const tintRightRef = useRef<HTMLSpanElement>(null);

  const card = game.currentCard;
  const liftRef = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState(0);
  const busy = exiting !== null || advanceTimer.current !== null;
  // Last card seen, so the hidden dock buttons keep a realistic label (and
  // therefore height) during interrupts / between cards.
  const lastCardRef = useRef(card);
  if (card) lastCardRef.current = card;
  const labelCard = card ?? lastCardRef.current;
  // Not enough dry powder for even the smallest check on this card.
  const broke =
    labelCard !== null &&
    labelCard !== undefined &&
    (game.isFundI ? labelCard.askM : Math.min(labelCard.askM, offerBounds(labelCard).checkMinM)) >
      game.capitalM;
  const actionsActive =
    card !== null && game.phase === 'meeting' && !sheetOpen && !challengeOpen;

  // Name font: from the card's sector pool, never the same as the previous
  // card's. Derived from deck order, so the harvest screen matches exactly.
  const deckFonts = useMemo(() => fontsForDeck(game.deck), [game.deck]);
  const nameFont = card ? deckFonts.get(card.pitchId) : undefined;

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
    // Callers already played the action cue (sign / pass / gavel); this adds
    // the outcome the engine decided.
    const outcome = res === 'signed' ? 'dealWon' : res === 'vetoed' || res === 'founderWalked' ? 'dealFail' : null;
    if (outcome) window.setTimeout(() => services.audio.play(outcome), RESULT_SFX_DELAY_MS);
    // Right = the money went in. Anything that doesn't land in the portfolio
    // (veto, lost challenge, founder walk) leaves left like a pass.
    flyOut(res === 'signed' ? 'right' : 'left');
  };

  const commit = (dir: SwipeDir): void => {
    if (!card || busy || sheetOpen) return;
    setTints(0);
    if (cardRef.current) showStamp(cardRef.current, dir);
    void services.haptics.tap(); // on commit only, never on drag start
    if (dir === 'left') {
      services.audio.play('pass');
      dispatch({ type: 'PASS' });
      flyOut('left');
      return;
    }
    if (game.isFundI) {
      services.audio.play('sign');
      finishFromResolution(dispatch({ type: 'SIGN_AT_ASK' }));
    } else {
      services.audio.play('draft'); // the term sheet comes out of the folder
      // The card isn't leaving yet: knock it back toward the centre, left a
      // little tilted with OFFER showing, while the terms are decided.
      if (cardRef.current) parkOffer(cardRef.current);
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
    !challengeOpen &&
    !portfolioOpen &&
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

  // Toasts (partner vetoes, markups…) drop in just under the ledger divider,
  // top-aligned with the mandate / portfolio row, so they never cover the
  // money or the meters. Measured live and handed to the app-level toast rail
  // as a CSS variable; other screens fall back to the rail's default.
  useLayoutEffect(() => {
    const root = screenRef.current;
    const shell = root?.closest<HTMLElement>('.app-shell');
    const sub = root?.querySelector<HTMLElement>('.run-subbar');
    if (!root || !shell || !sub) return;
    const place = (): void => {
      const top = sub.getBoundingClientRect().top - shell.getBoundingClientRect().top;
      shell.style.setProperty('--toast-top', `${Math.round(top)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(root);
    return () => {
      ro.disconnect();
      shell.style.removeProperty('--toast-top');
    };
  }, []);

  // An interrupt card (wire pro rata, bridge, capital call) rings as it lands,
  // so it never sneaks up on you mid-swipe. Keyed per interrupt.
  const interruptKey =
    game.phase === 'interrupt' && game.interrupt
      ? `${game.meetingIndex}-${game.interrupt.kind}`
      : null;
  useEffect(() => {
    if (interruptKey) services.audio.play('interrupt');
  }, [interruptKey]);

  // While the terms sheet is open, slide the pitch card up just enough that
  // its TEAM / TRACTION / DEAL HEAT rows clear the sheet — measured, so it
  // adapts to the sheet's height (sign vs negotiate, counter, board seat) and
  // to the screen size. Never lifts past the ledger bar.
  useLayoutEffect(() => {
    const root = screenRef.current;
    if ((!sheetOpen && !challengeOpen) || !root) {
      setLift(0);
      return;
    }
    const measure = (): void => {
      const wrap = liftRef.current;
      const stats = wrap?.querySelector<HTMLElement>('.pitch-stats');
      const sheet = root.querySelector<HTMLElement>('.sheet');
      const ledger = root.querySelector<HTMLElement>('.ledger-bar');
      if (!wrap || !stats || !sheet || !ledger) return;
      const room = topWithin(wrap, root) - (topWithin(ledger, root) + ledger.offsetHeight + LIFT_GAP_PX);
      const figures = wrap.querySelector<HTMLElement>('.pitch-figures');
      if (sheet.classList.contains('challenge-sheet') && figures) {
        // Minigames: the panel's top edge lands exactly on the card's
        // DEAL HEAT / ARR rule, whatever the game. Lift the card toward the
        // panel's natural top; if the panel is shorter than that, it grows
        // up to the rule (content stays centred, see .challenge-sheet).
        sheet.style.minHeight = '';
        const sheetTop = topWithin(sheet, root);
        const sheetBottom = sheetTop + sheet.offsetHeight;
        const ruleTop = topWithin(figures, root);
        const l = Math.max(0, Math.min(ruleTop - sheetTop, room));
        setLift(l);
        const liftedRule = ruleTop - l;
        if (liftedRule < sheetTop) sheet.style.minHeight = `${sheetBottom - liftedRule}px`;
        return;
      }
      const statsBottom = topWithin(stats, root) + stats.offsetHeight;
      const need = statsBottom + LIFT_GAP_PX - topWithin(sheet, root);
      setLift(Math.max(0, Math.min(need, room)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const sheet = root.querySelector<HTMLElement>('.sheet');
    if (sheet) ro.observe(sheet);
    return () => ro.disconnect();
  }, [sheetOpen, challengeOpen, game.phase, card?.pitchId]);

  return (
    <section className="screen run-screen" ref={screenRef} {...swipe}>
      <LedgerBar game={game} stageLabels={lines.reputationStages} />

      {/* Always-visible mandate + the persistent portfolio button. */}
      <div className="run-subbar">
        <p className="run-mandate">
          Mandate: {game.thesis.sectors[0]} &middot; {game.thesis.sectors[1]}
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-portfolio"
          data-sfx="open"
          onClick={() => {
            onPortfolioOpen();
            setPortfolioOpen(true);
          }}
          aria-label={`Portfolio, ${game.portfolio.length} companies`}
        >
          <span className="burger" aria-hidden="true" />
          Portfolio
          {game.portfolio.length > 0 && (
            <span key={game.portfolio.length} className="portfolio-count count-pop">
              {game.portfolio.length}
            </span>
          )}
        </button>
      </div>

      <div className="card-arena">
        {game.phase === 'interrupt' && game.interrupt ? (
          <InterruptCard
            // Remount per interrupt, so back-to-back ones each buzz.
            key={interruptKey ?? 'interrupt'}
            event={game.interrupt}
            game={game}
            companyFont={
              game.interrupt.kind === 'capitalCall'
                ? undefined
                : fontForCompany(deckFonts, game.interrupt.companyId)
            }
            onResolve={(accept) => {
              void services.haptics.tap();
              dispatch({ type: 'RESOLVE_INTERRUPT', accept });
            }}
          />
        ) : card ? (
          <div
            ref={liftRef}
            className="card-lift"
            style={{
              transform: lift ? `translateY(${-lift}px)` : undefined,
              transition: reducedMotion ? 'none' : undefined,
            }}
          >
            <SwipeShell
              key={`${card.pitchId}-${game.meetingIndex}`}
              ref={cardRef}
              exiting={exiting}
              stampLeft="PASS"
              stampRight="OFFER"
            >
              <PitchCardView card={card} memoNumber={game.meetingIndex + 1} nameFont={nameFont} />
            </SwipeShell>
          </div>
        ) : (
          <div className="arena-empty">No founders left in the lobby.</div>
        )}
        {challengeOpen &&
          card &&
          (() => {
            /**
             * Preview the round with the pure reducer so the minigame can play
             * toward the real result, but only COMMIT when it lands: money and
             * the portfolio badge must not move early. Same state + seeded RNG
             * means the commit matches the preview exactly.
             */
            const play = (call: ChallengeCall, revealMs: number): GameState | null => {
              const action = { type: 'RESOLVE_VETO_CHALLENGE', call } as const;
              const preview = reduce(game, action);
              window.setTimeout(() => {
                const committed = dispatch(action);
                // The engine's verdict for THIS round (last* fields can be stale
                // from an earlier, different minigame in the same run).
                const won = committed.resolution === 'signed';
                // The YOU WIN / YOU LOSE stamp lands a beat after the reveal.
                window.setTimeout(
                  () => services.audio.play(won ? 'sign' : 'pass'),
                  RESULT_STAMP_DELAY_MS,
                );
                window.setTimeout(() => {
                  setChallengeShow(null);
                  finishFromResolution(committed);
                }, COIN_HOLD_MS);
              }, revealMs);
              return preview;
            };
            const key = `${card.pitchId}-${game.meetingIndex}`;
            const seed = game.seed + game.meetingIndex;
            // Which minigame is on screen: the one playing out, else the pending one.
            const kind = challengeShow?.kind ?? pendingChallenge?.game ?? 'coin';
            if (kind === 'dice') {
              return (
                <DiceChallengeSheet
                  key={key}
                  lines={lines}
                  seed={seed}
                  result={challengeShow?.kind === 'dice' ? challengeShow.roll : null}
                  onCall={(call) => {
                    const roll = play(call, DICE_ROLL_MS)?.lastDice;
                    if (roll) setChallengeShow({ kind: 'dice', roll });
                  }}
                />
              );
            }
            if (kind === 'sticks') {
              return (
                <SticksChallengeSheet
                  key={key}
                  lines={lines}
                  seed={seed}
                  result={challengeShow?.kind === 'sticks' ? challengeShow.draw : null}
                  onCall={(call) => {
                    const draw = play(call, STICKS_REVEAL_MS)?.lastSticks;
                    if (draw) setChallengeShow({ kind: 'sticks', draw });
                  }}
                />
              );
            }
            if (kind === 'highLow') {
              const shown =
                challengeShow?.kind === 'highLow' ? challengeShow.shown : pendingChallenge?.shown;
              if (!shown) return null;
              return (
                <HighLowChallengeSheet
                  key={key}
                  lines={lines}
                  seed={seed}
                  shown={shown}
                  result={challengeShow?.kind === 'highLow' ? challengeShow.round : null}
                  onCall={(call) => {
                    const preview = play(call, CARD_REVEAL_MS);
                    const round = preview?.lastHighLow;
                    if (round) setChallengeShow({ kind: 'highLow', shown, round });
                  }}
                />
              );
            }
            return (
              <VetoChallengeSheet
                key={key}
                lines={lines}
                seed={seed}
                result={challengeShow?.kind === 'coin' ? challengeShow.flip : null}
                onCall={(call) => {
                  const preview = play(call, COIN_SPIN_MS);
                  const flip = preview?.lastCoinFlip;
                  if (flip) setChallengeShow({ kind: 'coin', flip });
                }}
              />
            );
          })()}
        {sheetOpen && card && (
          <SignSheet
            key={card.pitchId}
            card={card}
            game={game}
            lines={lines}
            onCancel={() => {
              // Back: the offer is withdrawn, the card straightens up.
              if (cardRef.current) springBack(cardRef.current);
              if (game.phase === 'meeting') setSheetOpen(false);
            }}
            onSignAtAsk={(boardSeat) => {
              void services.haptics.tap();
              services.audio.play('sign');
              finishFromResolution(dispatch({ type: 'SIGN_AT_ASK', boardSeat }));
            }}
            onNegotiate={() => {
              dispatch({ type: 'OPEN_NEGOTIATION' });
            }}
            onSendOffer={(offer) => {
              const wasFinal = game.negotiation?.round === 1;
              const next = dispatch({ type: 'SEND_OFFER', ...offer });
              if (next.phase === 'negotiation') {
                // Still talking: the founder parried with a counter.
                if (next.negotiation?.counter) services.audio.play('counter');
              } else {
                services.audio.play(wasFinal ? 'finalOffer' : 'sign');
                void services.haptics.tap();
                finishFromResolution(next);
              }
            }}
            onWalk={() => {
              services.audio.play('pass');
              finishFromResolution(dispatch({ type: 'WALK_AWAY' }));
            }}
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
              data-sfx="none"
              disabled={!actionsActive || busy}
              onClick={() => canSwipe('left') && commit('left')}
              aria-label="Pass on this deal"
            >
              Pass
            </button>
            <button
              type="button"
              data-sfx="none"
              // Broke: looks disabled but stays tappable, so a tap buzzes
              // and explains (canSwipe -> onBlockedSwipe) instead of nothing.
              disabled={!actionsActive || busy}
              aria-disabled={broke}
              className={`btn btn-sign ${broke ? 'btn-blocked' : ''}`}
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

      {portfolioOpen && (
        <PortfolioSheet
          game={game}
          lines={lines}
          onClose={() => setPortfolioOpen(false)}
          onSettings={() => {
            setPortfolioOpen(false);
            onSettings();
          }}
        />
      )}

      {/* Directional color wash at the column edges during drags. */}
      <span ref={tintLeftRef} className="swipe-tint tint-left" aria-hidden="true" />
      <span ref={tintRightRef} className="swipe-tint tint-right" aria-hidden="true" />
    </section>
  );
}
