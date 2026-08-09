import { useCallback, useEffect, useMemo, useState } from 'react';
import '../App.css';
import { loadContentAsync } from '../../content/loader';
import { SECTORS, type Pitch, type Sector } from '../../content/types';
import { rollCard } from '../../game/deck';
import { createRng, seedFromString } from '../../game/rng';
import { PitchCardView } from '../components/PitchCardView';

type Decision = 'keep' | 'kill' | 'edit' | 'flag';
interface DecisionEntry {
  decision: Decision;
  name?: string;
  idea?: string;
  at: string;
}
type Status = Decision | 'unreviewed';

const STATUS_FILTERS: Array<Status | 'all'> = ['unreviewed', 'keep', 'kill', 'edit', 'flag', 'all'];

/**
 * ?review=1 (dev only): every pitch as its real memo card, one at a time.
 * KEEP (k) / KILL (x) / EDIT (e) / FLAG (f). Decisions POST to the vite
 * middleware and land in src/content/review-state.json immediately;
 * `npm run apply-review` commits them to the content files.
 */
export function ReviewMode(): JSX.Element {
  const [pitches, setPitches] = useState<Pitch[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DecisionEntry>>({});
  const [sectorFilter, setSectorFilter] = useState<Sector | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('unreviewed');
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIdea, setEditIdea] = useState('');

  useEffect(() => {
    void loadContentAsync().then((content) => setPitches(content.pitches));
    void fetch('/__review')
      .then((res) => res.json())
      .then((state: { decisions?: Record<string, DecisionEntry> }) =>
        setDecisions(state.decisions ?? {}),
      )
      .catch(() => setDecisions({}));
  }, []);

  const statusOf = useCallback(
    (id: string): Status => decisions[id]?.decision ?? 'unreviewed',
    [decisions],
  );

  const filtered = useMemo(() => {
    if (!pitches) return [];
    return pitches.filter(
      (p) =>
        (sectorFilter === 'all' || p.sector === sectorFilter) &&
        (statusFilter === 'all' || statusOf(p.id) === statusFilter),
    );
  }, [pitches, sectorFilter, statusFilter, statusOf]);

  const current = filtered[Math.min(index, Math.max(0, filtered.length - 1))] ?? null;
  const pendingEdit = current ? decisions[current.id] : undefined;
  const shownName = pendingEdit?.name ?? current?.name ?? '';
  const shownIdea = pendingEdit?.idea ?? current?.idea ?? '';

  const decide = useCallback(
    (decision: Decision, edit?: { name: string; idea: string }): void => {
      if (!current) return;
      const entry: DecisionEntry = {
        decision,
        ...(edit ?? {}),
        at: new Date().toISOString(),
      };
      setDecisions((d) => ({ ...d, [current.id]: entry }));
      void fetch('/__review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pitchId: current.id, decision, ...(edit ?? {}) }),
      });
      setEditing(false);
      // Under the 'unreviewed' filter the list shrinks in place; elsewhere advance.
      if (statusFilter === 'all' || statusFilter === decision) {
        setIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
    },
    [current, filtered.length, statusFilter],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (editing || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (e.key === 'k') decide('keep');
      else if (e.key === 'x') decide('kill');
      else if (e.key === 'f') decide('flag');
      else if (e.key === 'e' && current) {
        setEditName(shownName);
        setEditIdea(shownIdea);
        setEditing(true);
      } else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, filtered.length - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, editing, current, shownName, shownIdea, filtered.length]);

  if (!pitches) return <main className="app-shell review-shell">Loading the pool&hellip;</main>;

  const reviewed = pitches.filter((p) => statusOf(p.id) !== 'unreviewed').length;
  const displayCard = current
    ? {
        ...rollCard(
          createRng(seedFromString(current.id)),
          { ...current, name: shownName, idea: shownIdea },
          false,
          false,
        ),
      }
    : null;

  return (
    <main className="app-shell review-shell game-surface">
      <header className="review-bar">
        <span className="review-title">CONTENT REVIEW</span>
        <span className="review-progress mono">
          {reviewed}/{pitches.length} reviewed &middot; showing {filtered.length}
        </span>
      </header>
      <div className="review-filters">
        <select value={sectorFilter} onChange={(e) => { setSectorFilter(e.target.value as Sector | 'all'); setIndex(0); }}>
          <option value="all">All sectors</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as Status | 'all'); setIndex(0); }}>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="review-arena">
        {displayCard && current ? (
          <div className="review-card-wrap">
            <PitchCardView card={displayCard} memoNumber={index + 1} />
            <div className="review-status mono">
              status: {statusOf(current.id)} &middot; {current.id}
            </div>
          </div>
        ) : (
          <p className="review-empty">Nothing matches this filter. The pile is clean.</p>
        )}
      </div>

      {editing && current ? (
        <div className="review-editor">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Name" />
          <textarea value={editIdea} onChange={(e) => setEditIdea(e.target.value)} rows={3} aria-label="Idea" />
          <div className="review-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sign"
              disabled={!editName.trim() || !editIdea.trim()}
              onClick={() => decide('edit', { name: editName.trim(), idea: editIdea.trim() })}
            >
              Save edit
            </button>
          </div>
        </div>
      ) : (
        <div className="review-actions">
          <button type="button" className="btn btn-sign" disabled={!current} onClick={() => decide('keep')}>
            Keep (k)
          </button>
          <button type="button" className="btn btn-pass" disabled={!current} onClick={() => decide('kill')}>
            Kill (x)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!current}
            onClick={() => {
              setEditName(shownName);
              setEditIdea(shownIdea);
              setEditing(true);
            }}
          >
            Edit (e)
          </button>
          <button type="button" className="btn btn-secondary" disabled={!current} onClick={() => decide('flag')}>
            Too silly (f)
          </button>
        </div>
      )}
    </main>
  );
}
