import { useLayoutEffect, useRef } from 'react';
import type { FirmNameParts } from '../../content/types';
import { splitFirmName } from '../../game/firm';
import { firmFont } from '../fonts/firmFonts';

/** Smallest size the name may shrink to before it's allowed to clip. */
const MIN_FONT_PX = 18;

/**
 * Firm name in a fixed-height title box (two lines, see `.title-fixed`), so
 * everything below it stays put whatever the firm. Generated names always
 * stack prefix over suffix ("DEAD CAT / & SONS"); custom names wrap freely.
 * Anything that would still need a third line (wide faces) shrinks to fit.
 */
export function FitFirmTitle({ name, parts }: { name: string; parts: FirmNameParts }): JSX.Element {
  const boxRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const split = splitFirmName(name, parts);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    const fit = (): void => {
      text.style.fontSize = ''; // back to the CSS size, then shrink if needed
      let size = parseFloat(getComputedStyle(text).fontSize);
      while (text.offsetHeight > box.clientHeight && size > MIN_FONT_PX) {
        size -= 1;
        text.style.fontSize = `${size}px`;
      }
    };
    fit();
    // Re-fit once the firm face has loaded, and on width changes.
    let alive = true;
    void document.fonts?.ready.then(() => alive && fit());
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [name]);

  return (
    <h1 ref={boxRef} className="letterhead-title title-fixed" aria-label={name}>
      <span ref={textRef} className="title-fit" data-firm-font={firmFont(name)}>
        {split ? (
          <>
            <span className="title-line">{split[0]}</span>
            <span className="title-line">{split[1]}</span>
          </>
        ) : (
          name
        )}
      </span>
    </h1>
  );
}
