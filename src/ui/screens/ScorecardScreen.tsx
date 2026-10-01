import { useCallback, useEffect, useRef } from 'react';
import type { GameState } from '../../game/types';
import type { FlavorLines } from '../../content/types';
import { verdictBucket } from '../../game/verdict';
import { fmtDpi, fmtM, pickLine } from '../format';
import { FirmName } from '../components/FirmName';
import { services } from '../../services';
import { useReducedMotion } from '../useReducedMotion';
import { useCountUp } from '../useCountUp';

/** DPI count-up length; the fanfare fires when it lands. */
const DPI_COUNT_MS = 1400;
/** One counter "pip" per this much DPI (0.05x), at most one per TICK_MIN_MS. */
const TICK_EVERY_DPI = 0.05;
const TICK_MIN_MS = 45;

export function ScorecardScreen({
  game,
  lines,
  onShare,
  onContinue,
}: {
  game: GameState;
  lines: FlavorLines;
  onShare: () => void;
  onContinue: () => void;
}): JSX.Element {
  const harvest = game.harvest;
  const reducedMotion = useReducedMotion();
  const finalDpi = harvest?.dpi ?? 0;
  // Close the loop: the DPI ticks up from 0.00x, then a small fanfare lands.
  const fanfared = useRef(false);
  const onLanded = useCallback(() => {
    if (fanfared.current || !harvest) return;
    fanfared.current = true;
    services.audio.play(harvest.dpi >= 1 ? 'fanfareGood' : 'fanfareBad');
  }, [harvest]);
  const shownDpi = useCountUp(finalDpi, DPI_COUNT_MS, { instant: reducedMotion, onDone: onLanded });
  const landed = shownDpi === finalDpi;

  // Score-counter pips while the DPI climbs; silent once it lands (fanfare).
  const lastStep = useRef(0);
  const lastTickAt = useRef(0);
  useEffect(() => {
    if (landed) return;
    const step = Math.floor(shownDpi / TICK_EVERY_DPI);
    if (step === lastStep.current) return;
    lastStep.current = step;
    const now = performance.now();
    if (now - lastTickAt.current < TICK_MIN_MS) return;
    lastTickAt.current = now;
    services.audio.play('countTick');
  }, [shownDpi, landed]);
  if (!harvest) return <section className="screen" />;
  const bucket = verdictBucket(harvest.dpi);
  const verdict = pickLine(lines.verdicts[bucket], game.seed);
  // Colour follows the ticking number, so crossing 1x flips red to green live.
  const good = shownDpi >= 1;

  return (
    <section className="screen letterhead scorecard">
      <div className="letterhead-rule">Internal memorandum &mdash; final</div>
      <p className="letterhead-kicker">
        <FirmName name={game.firmName} /> &middot; Fund {game.fundIndex}
      </p>
      <div className={`dpi-block ${good ? 'dpi-good' : 'dpi-bad'} ${landed ? 'dpi-landed' : ''}`}>
        <span className="dpi-label">DPI</span>
        <span className="dpi-value">{fmtDpi(shownDpi)}</span>
      </div>
      <p className="letterhead-thesis verdict-line">&ldquo;{verdict}&rdquo;</p>
      <dl className="figures-row figures-wrap">
        <div>
          <dt>Fund</dt>
          <dd>{fmtM(game.fundSizeM)}</dd>
        </div>
        <div>
          <dt>Returned</dt>
          {/* Counts up in lockstep with the DPI (same tween). */}
          <dd>{fmtM(landed ? harvest.returnedM : shownDpi * game.fundSizeM)}</dd>
        </div>
        <div>
          <dt>Checks</dt>
          <dd>{game.portfolio.length}</dd>
        </div>
        <div>
          <dt>Unicorns</dt>
          <dd>{harvest.unicorns}</dd>
        </div>
      </dl>
      {harvest.vetoedUnicorns > 0 && (
        <p className="heartbreak">
          Vetoed unicorns you were right about: {harvest.vetoedUnicorns}
        </p>
      )}
      <div className="screen-actions">
        <button type="button" className="btn btn-secondary" onClick={onShare}>
          Share the memo
        </button>
        <button type="button" className="btn btn-sign" onClick={onContinue}>
          What now?
        </button>
      </div>
    </section>
  );
}
