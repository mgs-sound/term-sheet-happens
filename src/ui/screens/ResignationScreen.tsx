import type { FlavorLines } from '../../content/types';
import type { GameState } from '../../game/types';
import { pickLine } from '../format';

/**
 * The career is over: the last fund ended in the red (board-seat legal fees
 * ate past every exit). No stay, no offers — a resignation letter, a fresh
 * name, and the ledger (with the obituary to share).
 */
export function ResignationScreen({
  game,
  lines,
  onNewCareer,
  onLedger,
}: {
  game: GameState;
  lines: FlavorLines;
  onNewCareer: () => void;
  onLedger: () => void;
}): JSX.Element {
  const copy = lines.careerOver;
  const [before, after] = copy.rule.split('{red}');
  return (
    <section className="screen letterhead rehire resignation">
      <div className="letterhead-rule">
        {before}
        <span className="resignation-scrawl">{copy.ruleRed}</span>
        {after}
      </div>
      <h2 className="rehire-inbox">{copy.inbox}</h2>
      <p className="resignation-line">{pickLine(copy.lines, game.seed)}</p>

      <div className="screen-actions">
        <button type="button" className="btn btn-danger" data-sfx="start" onClick={onNewCareer}>
          {copy.cta}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onLedger}>
          Career ledger
        </button>
      </div>
    </section>
  );
}
