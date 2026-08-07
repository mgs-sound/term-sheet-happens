import { forwardRef } from 'react';
import type { SwipeDir } from '../gesture/useColumnSwipe';

/**
 * The visual swipe card: stamps + content, driven imperatively by the
 * column-wide gesture (see gesture/cardVisual.ts). It owns no pointer
 * handling — the screen container does. Key it per card so inline drag
 * styles never leak between meetings.
 */
export const SwipeShell = forwardRef<
  HTMLDivElement,
  {
    exiting: SwipeDir | null;
    stampLeft: string;
    stampRight: string;
    children: React.ReactNode;
  }
>(function SwipeShell({ exiting, stampLeft, stampRight, children }, ref) {
  return (
    <div ref={ref} className={`swipe-card ${exiting ? `fly-${exiting}` : ''}`}>
      <span className="stamp stamp-pass" aria-hidden="true">
        {stampLeft}
      </span>
      <span className="stamp stamp-offer" aria-hidden="true">
        {stampRight}
      </span>
      {children}
    </div>
  );
});
