import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../game/types';
import type { ExitBucket, FlavorLines } from '../../content/types';
import { fillLine, fmtM, pickLine } from '../format';
import { fontForCompany, fontsForDeck } from '../fonts/cardFonts';
import { FirmName } from '../components/FirmName';
import { ScrollFade } from '../components/ScrollFade';
import { services, type SfxId } from '../../services';
import { useReducedMotion } from '../useReducedMotion';
import { useCountUp } from '../useCountUp';
import { BOARD_SEATS } from '../../game/tuning';

/** Reveal pacing (presentation only). First beat waits for the VHS whine. */
const FIRST_REVEAL_MS = 700;
/** Board-seat stamp lands this long after its company's exit. */
const SEAT_BEAT_MS = 320;
/** Per-company beat: slow and dramatic for small funds, sped up so a big
 *  portfolio still opens in ~REVEAL_TOTAL_MS. */
const REVEAL_MAX_MS = 650;
const REVEAL_MIN_MS = 170;
const REVEAL_TOTAL_MS = 6500;
/** Extra suspense before a unicorn lands. */
const UNICORN_PAUSE_MS = 450;
const TALLY_TWEEN_MS = 450;
/** "+$X" chip flight into the Returned tally. Matches the CSS animation. */
const INFLOW_MS = 900;

const REVEAL_SFX: Record<ExitBucket, SfxId> = {
  zero: 'dealFail',
  acquihire: 'exitModest',
  base: 'dealWon',
  win: 'dealWon',
  unicorn: 'unicorn',
};

/**
 * The distribution notice, revealed like an envelope being opened: one
 * company at a time, each stamped with its outcome, while a Returned tally
 * climbs. Skippable; instant under reduced motion. Outcomes were already
 * decided by the engine at HARVEST — this only paces how they're shown.
 */
export function HarvestScreen({
  game,
  lines,
  onContinue,
}: {
  game: GameState;
  lines: FlavorLines;
  onContinue: () => void;
}): JSX.Element {
  const harvest = game.harvest;
  const companies = harvest?.companies ?? [];
  const reducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(reducedMotion ? companies.length : 0);
  const done = revealed >= companies.length;
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  // Green "+$X" chips that fly up into Returned as each exit pays out.
  const [inflows, setInflows] = useState<{ id: number; amountM: number }[]>([]);
  const inflowTimers = useRef<number[]>([]);
  useEffect(() => () => inflowTimers.current.forEach((t) => window.clearTimeout(t)), []);

  // Drive the reveal: schedule the next company, play its stamp cue.
  useEffect(() => {
    if (done) return;
    const next = companies[revealed];
    const beat = Math.min(
      REVEAL_MAX_MS,
      Math.max(REVEAL_MIN_MS, REVEAL_TOTAL_MS / Math.max(1, companies.length)),
    );
    const delay =
      (revealed === 0 ? FIRST_REVEAL_MS : beat) +
      (next?.bucket === 'unicorn' ? UNICORN_PAUSE_MS : 0);
    const t = window.setTimeout(() => {
      if (next) {
        services.audio.play(REVEAL_SFX[next.bucket]);
        // Board seat lands a beat after the exit: a gavel for the bonus, the
        // error buzz for the liability.
        if (next.boardSeat) {
          const seatSfx: SfxId = next.boardSeat === 'liability' ? 'denied' : 'finalOffer';
          inflowTimers.current.push(
            window.setTimeout(() => services.audio.play(seatSfx), SEAT_BEAT_MS),
          );
        }
        if (next.proceedsM > 0 && !reducedMotion) {
          const id = revealed + 1;
          setInflows((f) => [...f, { id, amountM: next.proceedsM }]);
          inflowTimers.current.push(
            window.setTimeout(() => setInflows((f) => f.filter((x) => x.id !== id)), INFLOW_MS),
          );
        }
      }
      setRevealed((r) => r + 1);
    }, delay);
    return () => window.clearTimeout(t);
  }, [revealed, done, companies, reducedMotion]);

  // Keep the newest stamp on screen on long portfolios.
  useEffect(() => {
    if (revealed === 0 || reducedMotion) return;
    rowRefs.current[revealed - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [revealed, reducedMotion]);

  const returnedSoFar = companies
    .slice(0, revealed)
    .reduce((sum, c) => sum + c.proceedsM, 0);
  const tally = useCountUp(returnedSoFar, TALLY_TWEEN_MS, { instant: reducedMotion });

  if (!harvest) return <section className="screen" />;

  const heartbreaks = game.events.filter((e) => e.kind === 'vetoHeartbreak');
  // Same face each company had on its pitch card.
  const deckFonts = fontsForDeck(game.deck);

  return (
    <section className="screen letterhead fixed-frame">
      <div className="letterhead-rule">Distribution notice</div>
      <p className="letterhead-kicker">
        <FirmName name={game.firmName} />
      </p>

      <dl className="figures-row harvest-tally">
        <div>
          <dt>Fund</dt>
          <dd>{fmtM(game.fundSizeM)}</dd>
        </div>
        <div className="tally-returned">
          <dt>Returned</dt>
          {/* key replays the green flash each time money lands */}
          <dd
            key={inflows.length ? inflows[inflows.length - 1]!.id : 0}
            className={`${tally >= game.fundSizeM ? 'tally-over' : ''} ${
              tally < 0 ? 'tally-negative' : ''
            } ${
              inflows.length ? 'inflow-flash' : ''
            }`}
          >
            {fmtM(tally)}
          </dd>
          {inflows.map((f) => (
            <span key={f.id} className="inflow-chip" aria-hidden="true">
              +{fmtM(f.amountM)}
            </span>
          ))}
        </div>
        <div>
          <dt>Opened</dt>
          <dd>
            {revealed}/{companies.length}
          </dd>
        </div>
      </dl>

      <ScrollFade>
      {companies.length === 0 ? (
        <p className="letterhead-thesis">No investments were made. The fees, however, were.</p>
      ) : (
        <ul className="harvest-list">
          {companies.map((c, i) => {
            const shown = i < revealed;
            return (
              <li
                key={c.companyId}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className={`harvest-row ${shown ? 'reveal-in' : 'reveal-pending'} ${
                  shown && c.bucket === 'unicorn' ? 'reveal-unicorn' : ''
                } ${shown && c.boardSeat ? `reveal-seat-${c.boardSeat}` : ''}`}
                aria-hidden={!shown}
              >
                <div className="harvest-row-top">
                  <span className="harvest-name" data-font={fontForCompany(deckFonts, c.companyId)}>
                    {c.name}
                  </span>
                  <span
                    className={`harvest-label ${
                      c.bucket === 'zero'
                        ? 'label-red'
                        : c.bucket === 'acquihire'
                          ? ''
                          : c.bucket === 'unicorn'
                            ? 'label-green label-unicorn'
                            : 'label-green'
                    }`}
                  >
                    {lines.harvestOutcomeLabels[c.bucket]}
                  </span>
                </div>
                <div className="harvest-row-nums">
                  in {fmtM(c.investedM)} &rarr; out {fmtM(c.proceedsM)}
                </div>
                {c.boardSeat && (
                  <div className={`harvest-seat ${c.boardSeat === 'liability' ? 'is-liability' : ''}`}>
                    {c.boardSeat === 'liability'
                      ? lines.boardSeat.liability.replace(
                          '{pct}',
                          String(Math.round(BOARD_SEATS.zeroPenalty * 100)),
                        )
                      : lines.boardSeat.bonus.replace(
                          '{pct}',
                          String(Math.round((BOARD_SEATS.exitMult - 1) * 100)),
                        )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {done &&
        heartbreaks.map((e, i) => (
          <p key={i} className="heartbreak reveal-in">
            {fillLine(pickLine(lines.vetoHeartbreak, game.seed + i), {
              company: e.company ?? 'the one that got away',
            })}
          </p>
        ))}
      </ScrollFade>

      <div className="screen-actions">
        {done ? (
          <button type="button" className="btn btn-sign" data-sfx="none" onClick={onContinue}>
            To the scorecard
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            data-sfx="tap"
            onClick={() => setRevealed(companies.length)}
          >
            Skip
          </button>
        )}
      </div>
    </section>
  );
}
