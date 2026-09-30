import { useEffect, useRef, useState } from 'react';

/**
 * Animates a displayed number toward `target` (ease-out, requestAnimationFrame).
 * Each time `target` changes it tweens from wherever the display currently is,
 * so a running tally can keep climbing. `instant` (reduced motion) snaps.
 * Presentation only — the real value always lives in game state.
 */
export function useCountUp(
  target: number,
  durationMs: number,
  opts: { from?: number; instant?: boolean; onDone?: () => void } = {},
): number {
  const [value, setValue] = useState(opts.instant ? target : (opts.from ?? 0));
  const valueRef = useRef(value);
  const onDoneRef = useRef(opts.onDone);
  onDoneRef.current = opts.onDone;

  useEffect(() => {
    if (opts.instant || durationMs <= 0) {
      valueRef.current = target;
      setValue(target);
      onDoneRef.current?.();
      return;
    }
    const start = valueRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number): void => {
      // rAF timestamps can predate t0 by a frame: clamp so we never undershoot.
      const p = Math.min(1, Math.max(0, (now - t0) / durationMs));
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const v = start + (target - start) * eased;
      valueRef.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else onDoneRef.current?.();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, opts.instant]);

  return value;
}
