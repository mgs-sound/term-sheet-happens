import { useCallback, useEffect, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { RegisterRow, RegisterView } from '../../services/LeaderboardService';
import { services } from '../../services';
import { fmtM, pickLine } from '../format';

type State = { kind: 'loading' } | { kind: 'ready'; view: RegisterView } | { kind: 'unreachable' };

function Row({ row }: { row: RegisterRow }): JSX.Element {
  return (
    <li className={`register-row ${row.isYou ? 'register-you' : ''}`}>
      <span className="register-rank">#{row.rank}</span>
      <span className="register-name">{row.name}</span>
      <span className="register-total">{fmtM(row.totalReturnedM)}</span>
    </li>
  );
}

/** THE LP REGISTER — the global board, styled as a ruled ledger page. */
export function RegisterScreen({
  careerId,
  lines,
  onBack,
}: {
  careerId: string | null;
  lines: FlavorLines;
  onBack: () => void;
}): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const refresh = useCallback((): void => {
    setState({ kind: 'loading' });
    void services.leaderboard.fetchBoard(careerId).then((view) => {
      setState(view ? { kind: 'ready', view } : { kind: 'unreachable' });
    });
  }, [careerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const view = state.kind === 'ready' ? state.view : null;
  const meBelowTop = view?.me && !view.top.some((r) => r.isYou) ? view.me : null;

  return (
    <section className="screen letterhead register-screen">
      <div className="letterhead-rule">The LP register</div>

      {state.kind === 'loading' && <p className="letterhead-thesis">Pulling the ledger&hellip;</p>}

      {state.kind === 'unreachable' && (
        <p className="register-unreachable">{pickLine(lines.registerUnreachable, Date.now() % 97)}</p>
      )}

      {view && (
        <>
          <ul className="register-list">
            {view.top.map((row) => (
              <Row key={row.rank} row={row} />
            ))}
            {view.top.length === 0 && (
              <p className="letterhead-thesis">The register is empty. History awaits a fool.</p>
            )}
          </ul>
          {meBelowTop && (
            <>
              <div className="register-gap">&hellip;</div>
              <ul className="register-list">
                {meBelowTop.neighbors.map((row) => (
                  <Row key={row.rank} row={row} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <div className="screen-actions">
        <button type="button" className="btn btn-secondary" onClick={refresh}>
          Refresh the ledger
        </button>
        <button type="button" className="btn btn-sign" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
