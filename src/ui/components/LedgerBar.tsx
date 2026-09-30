import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../game/types';
import { reputationStage } from '../../game/meters';
import { fmtM } from '../format';
import { FirmName } from './FirmName';
import { useCountUp } from '../useCountUp';
import { useReducedMotion } from '../useReducedMotion';

/** How long a "−$1.6M" receipt floats before it's removed. Matches the CSS. */
const FLOATER_MS = 1100;
/** Dry-powder count-down length. */
const SPEND_TWEEN_MS = 500;

/**
 * Dry powder with spend juice: whenever capital drops (signing, follow-on,
 * bridge, capital call) a red "−$X" receipt peels off the number and drifts
 * away, the number counts down to its new value, and flashes red once.
 */
function DryPowder({ capitalM }: { capitalM: number }): JSX.Element {
  const reducedMotion = useReducedMotion();
  const shown = useCountUp(capitalM, SPEND_TWEEN_MS, { from: capitalM, instant: reducedMotion });
  const prev = useRef(capitalM);
  const nextId = useRef(1);
  const [floaters, setFloaters] = useState<{ id: number; deltaM: number }[]>([]);
  const [spends, setSpends] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const delta = capitalM - prev.current;
    prev.current = capitalM;
    if (delta >= -0.001) return; // only spending gets the juice
    const id = nextId.current++;
    setSpends((n) => n + 1);
    setFloaters((f) => [...f, { id, deltaM: delta }]);
    // Each receipt removes itself; back-to-back spends don't cancel each other.
    timers.current.push(
      window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), FLOATER_MS),
    );
  }, [capitalM]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  return (
    <div className="dry-powder">
      <dt>Dry powder</dt>
      {/* key replays the red flash on every spend */}
      <dd key={spends} className={spends > 0 ? 'spend-flash' : undefined}>
        {fmtM(shown)}
      </dd>
      {!reducedMotion &&
        floaters.map((f) => (
          <span key={f.id} className="spend-floater" aria-hidden="true">
            &minus;{fmtM(-f.deltaM)}
          </span>
        ))}
    </div>
  );
}

/** Top ledger strip: firm line + mono meters. */
export function LedgerBar({
  game,
  stageLabels,
}: {
  game: GameState;
  stageLabels: string[];
}): JSX.Element {
  const meetingsLeft = game.meetingsTotal - game.meetingIndex;
  return (
    <header className="ledger-bar">
      <div className="ledger-firm">
        <FirmName name={game.firmName} />
        <span className="ledger-quarter">Q{game.quarter}</span>
      </div>
      <dl className="ledger-meters">
        <DryPowder capitalM={game.capitalM} />
        <div>
          <dt>Meetings</dt>
          <dd>
            {meetingsLeft}/{game.meetingsTotal}
          </dd>
        </div>
        <div>
          <dt>Rep</dt>
          <dd className="ledger-rep">{stageLabels[reputationStage(game.reputation)]}</dd>
        </div>
        <div>
          <dt>LP trust</dt>
          <dd>{Math.round(game.lpTrust)}</dd>
        </div>
      </dl>
    </header>
  );
}
