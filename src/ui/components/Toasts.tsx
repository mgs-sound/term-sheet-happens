import { useEffect } from 'react';

export interface Toast {
  id: number;
  text: string;
  tone: 'ink' | 'red' | 'green';
}

const TOAST_MS = 2600;

export function Toasts({
  toasts,
  onExpire,
}: {
  toasts: Toast[];
  onExpire: (id: number) => void;
}): JSX.Element {
  const first = toasts[0];
  useEffect(() => {
    if (!first) return;
    const timer = setTimeout(() => onExpire(first.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [first, onExpire]);

  return (
    <div className="toast-rail" role="status" aria-live="polite">
      {toasts.slice(0, 2).map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
