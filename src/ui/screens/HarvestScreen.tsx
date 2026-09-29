import type { GameState } from '../../game/types';
import type { FlavorLines } from '../../content/types';
import { fillLine, fmtM, pickLine } from '../format';
import { fontForCompany, fontsForDeck } from '../fonts/cardFonts';
import { FirmName } from '../components/FirmName';

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
  if (!harvest) return <section className="screen" />;

  const heartbreaks = game.events.filter((e) => e.kind === 'vetoHeartbreak');
  // Same face each company had on its pitch card (companyId === pitchId).
  const deckFonts = fontsForDeck(game.deck);

  return (
    <section className="screen letterhead harvest-screen">
      <div className="letterhead-rule">Distribution notice</div>
      <p className="letterhead-kicker">
        <FirmName name={game.firmName} />
      </p>

      {harvest.companies.length === 0 ? (
        <p className="letterhead-thesis">No investments were made. The fees, however, were.</p>
      ) : (
        <ul className="harvest-list">
          {harvest.companies.map((c) => (
            <li key={c.companyId} className="harvest-row">
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
          ))}
        </ul>
      )}

      {heartbreaks.map((e, i) => (
        <p key={i} className="heartbreak">
          {fillLine(pickLine(lines.vetoHeartbreak, game.seed + i), {
            company: e.company ?? 'the one that got away',
          })}
        </p>
      ))}

      <div className="screen-actions">
        <button type="button" className="btn btn-sign" data-sfx="none" onClick={onContinue}>
          To the scorecard
        </button>
      </div>
    </section>
  );
}
