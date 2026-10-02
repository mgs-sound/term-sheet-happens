/**
 * The verdict stamp slammed across a challenge panel once the result is in:
 * green "YOU WIN" / red "YOU LOSE", same rubber-stamp language as PASS/OFFER.
 * Purely visual; the panel positions it.
 */
export function ResultStamp({ won, text }: { won: boolean; text: string }): JSX.Element {
  return (
    <div className={`result-stamp ${won ? 'result-won' : 'result-lost'}`} role="status">
      {text}
    </div>
  );
}
