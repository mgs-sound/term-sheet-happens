import { useRef, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { CareerState, GameState } from '../../game/types';
import { SWIPE } from '../../game/tuning';
import { fmtDpi, fmtM, pickLine } from '../format';
import { applyDrag, showStamp, springBack } from '../gesture/cardVisual';
import { useColumnSwipe, type SwipeDir } from '../gesture/useColumnSwipe';
import { SwipeShell } from '../components/SwipeShell';
import { useReducedMotion } from '../useReducedMotion';

type Stage = 'notice' | 'finalCard' | 'credits';

/**
 * The endgame: Enlightenment notice -> the final card (a young associate
 * pitching YOU their fund; you swipe on them) -> credits + endless unlock.
 * Purely presentational — the career is already enlightened in state.
 */
export function EnlightenmentScreen({
  game,
  nextCareer,
  lines,
  onEndless,
}: {
  game: GameState;
  nextCareer: CareerState;
  lines: FlavorLines;
  onEndless: () => void;
}): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('notice');
  const [choice, setChoice] = useState<SwipeDir | null>(null);
  const [exiting, setExiting] = useState<SwipeDir | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const swipeFinal = (dir: SwipeDir): void => {
    if (exiting) return;
    if (cardRef.current) showStamp(cardRef.current, dir);
    setExiting(dir);
    window.setTimeout(
      () => {
        setChoice(dir);
        setStage('credits');
      },
      reducedMotion ? 40 : 340,
    );
  };

  const commitDistancePx = (): number =>
    (sectionRef.current?.clientWidth ?? 390) * SWIPE.commitDistanceRatio;

  // The final card takes column-wide swipes too — it's the point of the bit.
  const swipe = useColumnSwipe({
    enabled: () => stage === 'finalCard' && exiting === null,
    getCommitDistancePx: commitDistancePx,
    canSwipe: () => true,
    onDrag: (dx) => {
      if (cardRef.current) applyDrag(cardRef.current, dx, commitDistancePx());
    },
    onRelease: () => {
      if (cardRef.current) springBack(cardRef.current);
    },
    onCommit: swipeFinal,
  });

  if (stage === 'notice') {
    return (
      <section className="screen letterhead enlightenment">
        <div className="letterhead-rule">Memorandum of enlightenment</div>
        <h1 className="letterhead-title glow">Enlightened</h1>
        <p className="letterhead-thesis">{pickLine(lines.enlightenmentLines, game.seed)}</p>
        <dl className="figures-row">
          <div>
            <dt>Final fund</dt>
            <dd>{fmtM(game.fundSizeM)}</dd>
          </div>
          <div>
            <dt>DPI</dt>
            <dd>{game.harvest ? fmtDpi(game.harvest.dpi) : '—'}</dd>
          </div>
          <div>
            <dt>Career AUM</dt>
            <dd>{fmtM(nextCareer.aumM)}</dd>
          </div>
        </dl>
        <div className="screen-actions">
          <button type="button" className="btn btn-sign" onClick={() => setStage('finalCard')}>
            There is one more meeting
          </button>
        </div>
      </section>
    );
  }

  if (stage === 'finalCard') {
    return (
      <section className="screen run-screen" ref={sectionRef} {...swipe}>
        <header className="ledger-bar">
          <div className="ledger-firm">
            <span>The last meeting</span>
            <span className="ledger-quarter">&infin;</span>
          </div>
        </header>
        <div className="card-arena">
          <SwipeShell ref={cardRef} exiting={exiting} stampLeft="PASS" stampRight="FUND">
            <div className="pitch-card">
              <div className="pitch-head">
                <span>EVERY SECTOR</span>
                <span>FUND I</span>
              </div>
              <h2 className="pitch-name">A Young Associate</h2>
              <p className="pitch-idea">
                &ldquo;{pickLine(lines.finalCardPitches, game.seed)}&rdquo;
              </p>
              <div className="pitch-figures">
                <div>
                  <span className="fig-label">THEIR FUND</span>
                  <span className="fig-value">$8.0M</span>
                </div>
                <div>
                  <span className="fig-label">TRACK RECORD</span>
                  <span className="fig-value">none</span>
                </div>
                <div>
                  <span className="fig-label">CONFIDENCE</span>
                  <span className="fig-value">total</span>
                </div>
              </div>
              <div className="pitch-foot">DEAL MEMO No. &infin;</div>
            </div>
          </SwipeShell>
        </div>
        <div className="swipe-actions">
          <button type="button" className="btn btn-pass" onClick={() => swipeFinal('left')}>
            Pass
          </button>
          <button type="button" className="btn btn-sign" onClick={() => swipeFinal('right')}>
            Fund them
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen letterhead credits">
      <div className="letterhead-rule">Credits</div>
      <h1 className="letterhead-title">
        Term Sheet
        <br />
        Happens
      </h1>
      <p className="letterhead-thesis">
        {choice === 'right' ? 'You wired it. Of course you did.' : 'You passed. They’ll be fine. Probably.'}
      </p>
      <ul className="credits-lines">
        {lines.creditsLines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <div className="enlightened-tab">ENDLESS MODE UNLOCKED</div>
      <div className="screen-actions">
        <button type="button" className="btn btn-sign" onClick={onEndless}>
          Keep deploying
        </button>
      </div>
    </section>
  );
}
