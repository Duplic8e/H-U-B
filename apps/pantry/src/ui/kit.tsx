import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { liveQuery } from 'dexie';

/** Subscribes to a Dexie query; `undefined` until the first result. Re-runs when `deps` change. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: (e) => console.error('liveQuery failed', e) });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

const PATHS = {
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  hub: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  back: <path d="M15 18l-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  scan: <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M8 9v6M12 9v6M16 9v6" />,
} as const;

export function Icon({ name, class: cls = 'ico' }: { name: keyof typeof PATHS; class?: string }) {
  return <svg viewBox="0 0 24 24" class={cls} aria-hidden="true">{PATHS[name]}</svg>;
}

export function Header({ title, back, actions }: { title: string; back?: { href: string; label: string }; actions?: ComponentChildren }) {
  return (
    <header class="header">
      {back && (
        <div class="header-inner" style={{ paddingBottom: 0, minHeight: 44 }}>
          <a class="back" href={back.href}><Icon name="back" />{back.label}</a>
        </div>
      )}
      <div class="header-inner" style={back ? { paddingTop: 0 } : undefined}>
        <h1>{title}</h1>
        {actions}
      </div>
    </header>
  );
}

/** Bottom sheet with a title, closed by the scrim, the X or Escape. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="scrim" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Minus, count, plus. */
export function Stepper({ value, onChange, label, min = 0, large }: { value: number; onChange: (next: number) => void; label: string; min?: number; large?: boolean }) {
  return (
    <div class={`stepper${large ? ' large' : ''}`} role="group" aria-label={label}>
      <button type="button" aria-label="One fewer" disabled={value <= min} onClick={() => onChange(value - 1)}><Icon name="minus" /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="One more" onClick={() => onChange(value + 1)}><Icon name="plus" /></button>
    </div>
  );
}

/** Product photo, or the first letter of the name when there is none or it fails to load. */
export function Thumb({ name, src, big }: { name: string; src?: string; big?: boolean }) {
  const [failed, setFailed] = useState<string>();
  const cls = `thumb${big ? ' big' : ''}`;
  if (src && failed !== src) return <img class={cls} src={src} alt="" loading="lazy" referrerpolicy="no-referrer" onError={() => setFailed(src)} />;
  return <span class={cls} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>;
}
