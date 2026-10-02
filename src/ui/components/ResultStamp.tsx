/**
 * The verdict stamp slammed across a challenge panel once the result is in:
 * "YOU WIN" / "YOU LOSE" in ink on sign-here yellow (no red/green: those
 * colours belong to the sides you call). Rubber-stamp slam like PASS/OFFER.
 * Purely visual; the panel positions it.
 */
export function ResultStamp({ won, text }: { won: boolean; text: string }): JSX.Element {
  return (
    <div className={`result-stamp ${won ? 'result-won' : 'result-lost'}`} role="status">
      {text}
    </div>
  );
}
