import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * A scrolling middle region with paper-coloured fades at the top/bottom edge
 * that appear ONLY while there's more content hidden that way — a "this
 * continues" affordance, not decoration. The surrounding header and actions
 * stay fixed; only this region scrolls.
 */
export const ScrollFade = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  function ScrollFade({ children }, ref) {
    const inner = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => inner.current as HTMLDivElement);
    const [edges, setEdges] = useState({ top: false, bottom: false });

    const measure = useCallback(() => {
      const el = inner.current;
      if (!el) return;
      const top = el.scrollTop > 2;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setEdges((e) => (e.top === top && e.bottom === bottom ? e : { top, bottom }));
    }, []);

    useEffect(() => {
      const el = inner.current;
      if (!el) return;
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      // Content growing (e.g. harvest rows revealing) changes scrollHeight.
      const mo = new MutationObserver(measure);
      mo.observe(el, { childList: true, subtree: true, attributes: true });
      return () => {
        ro.disconnect();
        mo.disconnect();
      };
    }, [measure]);

    return (
      <div
        className={`scroll-fade ${edges.top ? 'more-above' : ''} ${
          edges.bottom ? 'more-below' : ''
        }`}
      >
        <div ref={inner} className="scroll-fade-inner" onScroll={measure}>
          {children}
        </div>
      </div>
    );
  },
);
