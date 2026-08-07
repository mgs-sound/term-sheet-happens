/**
 * Imperative card visuals for the column-wide swipe: the memo card follows
 * the drag (translate + rotate + stamp opacity) no matter where the finger
 * is. Direct style writes keep drags off the React render path.
 */

import { SWIPE } from '../../game/tuning';
import { clamp } from '../../game/util';

function setStamps(card: HTMLElement, passOpacity: number, offerOpacity: number): void {
  const pass = card.querySelector<HTMLElement>('.stamp-pass');
  const offer = card.querySelector<HTMLElement>('.stamp-offer');
  if (pass) pass.style.opacity = String(passOpacity);
  if (offer) offer.style.opacity = String(offerOpacity);
}

export function applyDrag(card: HTMLElement, dx: number, commitDistancePx: number): void {
  card.style.transition = 'none';
  card.style.transform = `translateX(${dx}px) rotate(${clamp(dx * 0.08, -12, 12)}deg)`;
  const strength = Math.min(1, Math.abs(dx) / commitDistancePx);
  setStamps(card, dx < 0 ? strength : 0, dx > 0 ? strength : 0);
}

export function springBack(card: HTMLElement): void {
  card.style.transition = `transform ${SWIPE.springBackMs}ms ease-out`;
  card.style.transform = 'translateX(0) rotate(0deg)';
  setStamps(card, 0, 0);
}

/** Full-opacity stamp for commits from buttons, keyboard, or short flicks. */
export function showStamp(card: HTMLElement, dir: 'left' | 'right'): void {
  setStamps(card, dir === 'left' ? 1 : 0, dir === 'right' ? 1 : 0);
}
