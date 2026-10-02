import { useEffect, useState } from 'react';
import type { FlavorLines } from '../../content/types';
import type { HighLowCall, PlayingCard } from '../../game/types';
import { pickLine } from '../format';
import { ResultStamp } from './ResultStamp';

/** Suspense before the hidden card turns over (matches the cardFlip cue). */
export const CARD_REVEAL_MS = 700;

/** How many "?" marks tile the card back. */
const CARD_BACK_MARKS = 72; // overfills; .card-back-pattern clips the rest

const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const SUIT_GLYPH = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as const;

function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

/** One playing card face. `tone` colours it: ink, or the higher/lower colour. */
function CardFace({
  card,
  tone,
}: {
  card: PlayingCard;
  tone: 'ink' | 'higher' | 'lower';
}): JSX.Element {
  return (
    <div className={`playing-card card-${tone}`} aria-label={`${rankLabel(card.rank)} of ${card.suit}`}>
      <span className="card-rank">{rankLabel(card.rank)}</span>
      <span className="card-suit">{SUIT_GLYPH[card.suit]}</span>
    </div>
  );
}

/**
 * The partner's other "leadership challenge": one card face up, call whether
 * the hidden one is higher or lower. Same slot and style as the coin sheet
 * (class `sheet`, so the pitch card lifts above it). The engine has already
 * decided when `result` arrives; this only stages the reveal.
 */
export function HighLowChallengeSheet({
  lines,
  seed,
  shown,
  result,
  onCall,
}: {
  lines: FlavorLines;
  seed: number;
  shown: PlayingCard;
  result: { call: HighLowCall; hidden: PlayingCard; won: boolean } | null;
  onCall: (call: HighLowCall) => void;
}): JSX.Element {
  const copy = lines.vetoChallenge;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(() => setRevealed(true), CARD_REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [result]);

  const line =
    result && revealed
      ? pickLine(result.won ? copy.highLowWon : copy.highLowLost, seed)
      : pickLine(copy.highLowIntros, seed);

  return (
    <div className="sheet challenge-sheet" role="dialog" aria-label={copy.title}>
      <div className="challenge-title">{copy.title}</div>
      <p className="challenge-line">{line}</p>

      <div className="card-stage">
        {/* The face-up card is always ink, so it never reads as a button colour. */}
        <CardFace card={shown} tone="ink" />
        <div className={`card-slot ${result && !revealed ? 'card-dealing' : ''}`}>
          {result && revealed ? (
            <div className="card-flip-in">
              {/* Revealed card wears the colour of where it landed: higher green, lower red. */}
              <CardFace
                card={result.hidden}
                tone={result.hidden.rank > shown.rank ? 'higher' : 'lower'}
              />
            </div>
          ) : (
            <div className="playing-card card-back" aria-label="Hidden card">
              <span className="card-back-pattern" aria-hidden="true">
                {/* Zero-width spaces: line breaking won't split before a "?" otherwise. */}
                {Array.from({ length: CARD_BACK_MARKS }, () => '?').join('\u200b')}
              </span>
            </div>
          )}
        </div>
      </div>

      {result && revealed && (
        <ResultStamp won={result.won} text={result.won ? copy.stampWon : copy.stampLost} />
      )}

      <div className="challenge-actions">
        {(['lower', 'higher'] as const).map((side) => {
          const chosen = result?.call === side;
          return (
            <div key={side} className="challenge-option">
              <button
                type="button"
                className={`btn ${side === 'lower' ? 'btn-heads' : 'btn-sign'} ${
                  chosen ? 'is-chosen' : ''
                }`}
                data-sfx="cardFlip"
                disabled={result !== null}
                onClick={() => onCall(side)}
              >
                {side === 'lower' ? 'Lower' : 'Higher'}
              </button>
              <span className={`you-chose ${chosen ? 'is-shown' : ''}`} aria-hidden={!chosen}>
                {copy.youChose}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
