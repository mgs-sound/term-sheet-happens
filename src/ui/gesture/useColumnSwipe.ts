/**
 * Column-wide swipe gesture: pointer handling lives on the screen CONTAINER,
 * so horizontal swipes work from anywhere — over the ledger, the card, or
 * the action buttons. Tap-vs-swipe disambiguation:
 *
 *  - Nothing is a swipe until movement exceeds SWIPE.slopPx. Within slop, a
 *    pointerup over a button is a normal tap (we haven't captured, so native
 *    click flow is untouched).
 *  - At slop exit, horizontal intent lock: |dx| > |dy| starts the swipe
 *    (pointer captured, later click suppressed in the capture phase);
 *    otherwise the whole gesture is ignored.
 *  - Commit on distance (fraction of column width) or flick (velocity +
 *    minimum travel); anything less springs back.
 */

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';
import { SWIPE } from '../../game/tuning';

export type SwipeDir = 'left' | 'right';

export interface ColumnSwipeOptions {
  /** Read fresh each event — modals/exits disable the gesture entirely. */
  enabled: () => boolean;
  getCommitDistancePx: () => number;
  canSwipe: (dir: SwipeDir) => boolean;
  onDrag: (dx: number) => void;
  onRelease: () => void;
  onCommit: (dir: SwipeDir) => void;
}

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastT: number;
  velocity: number; // px/ms, signed
  mode: 'pending' | 'active' | 'rejected';
}

export interface ColumnSwipeHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  onClickCapture: (e: ReactMouseEvent<HTMLElement>) => void;
}

export function useColumnSwipe(opts: ColumnSwipeOptions): ColumnSwipeHandlers {
  const gesture = useRef<GestureState | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>): void => {
    suppressClick.current = false;
    if (gesture.current || !e.isPrimary || !opts.enabled()) return;
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: e.timeStamp,
      velocity: 0,
      mode: 'pending',
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>): void => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (g.mode === 'pending') {
      if (Math.abs(dx) < SWIPE.slopPx && Math.abs(dy) < SWIPE.slopPx) return;
      if (Math.abs(dx) > Math.abs(dy) && opts.enabled()) {
        g.mode = 'active';
        suppressClick.current = true; // a drag must never fire a button
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        g.mode = 'rejected'; // vertical intent: not ours
        return;
      }
    }
    if (g.mode !== 'active') return;

    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.velocity = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    opts.onDrag(dx);
  };

  const end = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean): void => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    if (g.mode !== 'active') return; // tap (native click) or rejected

    const dx = e.clientX - g.startX;
    const dir: SwipeDir = dx < 0 ? 'left' : 'right';
    const distanceCommit = Math.abs(dx) >= opts.getCommitDistancePx();
    const flickCommit =
      Math.abs(g.velocity) >= SWIPE.flickVelocity &&
      Math.abs(dx) >= SWIPE.flickMinDistancePx &&
      Math.sign(g.velocity) === Math.sign(dx);

    if (!cancelled && dx !== 0 && (distanceCommit || flickCommit) && opts.canSwipe(dir)) {
      opts.onCommit(dir);
    } else {
      opts.onRelease();
    }
  };

  const onClickCapture = (e: ReactMouseEvent<HTMLElement>): void => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e) => end(e, false),
    onPointerCancel: (e) => end(e, true),
    onClickCapture,
  };
}
