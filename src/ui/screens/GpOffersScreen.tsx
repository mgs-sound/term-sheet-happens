import type { Content } from '../../content/types';
import type { CareerState } from '../../game/types';
import { fmtM, pickLine } from '../format';

/** GP promotion: choose between three LP offer packages. */
export function GpOffersScreen({
  career,
  content,
  onAccept,
}: {
  career: CareerState;
  content: Content;
  onAccept: (offerIndex: number) => void;
}): JSX.Element {
  const offers = career.pendingOffers ?? [];
  return (
    <section className="screen letterhead offers-screen">
      <div className="letterhead-rule">Term sheets &mdash; yours, for once</div>
      <p className="letterhead-kicker">Three LP syndicates want to anchor you</p>
      <div className="offers-list">
        {offers.map((offer, i) => {
          const thesis = content.theses.find((t) => t.id === offer.thesisId);
          return (
            <button
              key={i}
              type="button"
              className="offer-card"
              onClick={() => onAccept(i)}
              aria-label={`Accept offer ${i + 1}: ${fmtM(offer.fundSizeM)}`}
            >
              <div className="offer-size">{fmtM(offer.fundSizeM)}</div>
              {thesis && (
                <p className="offer-thesis">
                  &ldquo;{thesis.line}&rdquo;
                  <span className="offer-sectors">
                    {thesis.sectors[0]} &middot; {thesis.sectors[1]}
                  </span>
                </p>
              )}
              <p className="offer-quirk">
                {pickLine(content.lines.lpOfferQuirks, offer.quirkIndex)}
              </p>
              <span className="offer-cta">Accept &rarr;</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
