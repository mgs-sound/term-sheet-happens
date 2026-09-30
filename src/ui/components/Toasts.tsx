import { useEffect, useState } from 'react';

export interface Toast {
  id: number;
  text: string;
  tone: 'ink' | 'red' | 'green';
}

const TOAST_MS = 2600;
/** The last slice of a toast's life is a fade-out (matches .toast-leaving). */
const TOAST_FADE_MS = 280;

export function Toasts({
  toasts,
  onExpire,
}: {
  toasts: Toast[];
  onExpire: (id: number) => void;
}): JSX.Element {
  const first = toasts[0];
  const [leavingId, setLeavingId] = useState<number | null>(null);
  useEffect(() => {
    if (!first) return;
    const fade = setTimeout(() => setLeavingId(first.id), TOAST_MS - TOAST_FADE_MS);
    const timer = setTimeout(() => onExpire(first.id), TOAST_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(timer);
    };
  }, [first, onExpire]);

  return (
    <div className="toast-rail" role="status" aria-live="polite">
      {toasts.slice(0, 2).map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.tone} ${t.id === leavingId ? 'toast-leaving' : ''}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
