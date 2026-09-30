import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../game/types';
import type { ExitBucket, FlavorLines } from '../../content/types';
import { fillLine, fmtM, pickLine } from '../format';
import { fontForCompany, fontsForDeck } from '../fonts/cardFonts';
import { FirmName } from '../components/FirmName';
import { services, type SfxId } from '../../services';
import { useReducedMotion } from '../useReducedMotion';
import { useCountUp } from '../useCountUp';

/** Reveal pacing (presentation only). First beat waits for the VHS whine. */
const FIRST_REVEAL_MS = 700;
/** Per-company beat: slow and dramatic for small funds, sped up so a big
 *  portfolio still opens in ~REVEAL_TOTAL_MS. */
const REVEAL_MAX_MS = 650;
const REVEAL_MIN_MS = 170;
const REVEAL_TOTAL_MS = 6500;
/** Extra suspense before a unicorn lands. */
const UNICORN_PAUSE_MS = 450;
const TALLY_TWEEN_MS = 450;

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
      if (next) services.audio.play(REVEAL_SFX[next.bucket]);
      setRevealed((r) => r + 1);
    }, delay);
    return () => window.clearTimeout(t);
  }, [revealed, done, companies]);

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
    <section className="screen letterhead harvest-screen">
      <div className="letterhead-rule">Distribution notice</div>
      <p className="letterhead-kicker">
        <FirmName name={game.firmName} />
      </p>

      <dl className="figures-row harvest-tally">
        <div>
          <dt>Fund</dt>
          <dd>{fmtM(game.fundSizeM)}</dd>
        </div>
        <div>
          <dt>Returned</dt>
          <dd className={tally >= game.fundSizeM ? 'tally-over' : ''}>{fmtM(tally)}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>
            {revealed}/{companies.length}
          </dd>
        </div>
      </dl>

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
                }`}
                aria-hidden={!shown}
              >
                <div className="harvest-row-top">
                  <span className="harvest-name" data-font={fontForCompany(deckFonts, c.companyId)}>
                    {c.name}
                  </span>
                  <span
                    className={`harvest-label ${
                      c.bucket === 'zero' ? 'label-red' : c.bucket === 'acquihire' ? '' : 'label-green'
                    }`}
                  >
                    {lines.harvestOutcomeLabels[c.bucket]}
                    {c.boardPush === 'improved' && ' ↑'}
                    {c.boardPush === 'zeroed' && ' ✗'}
                  </span>
                </div>
                <div className="harvest-row-nums">
                  in {fmtM(c.investedM)} &rarr; out {fmtM(c.proceedsM)}
                </div>
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

      <div className="screen-actions harvest-actions">
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
