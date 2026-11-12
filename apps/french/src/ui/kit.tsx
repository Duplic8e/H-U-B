import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { liveQuery } from 'dexie';
import { useState } from 'preact/hooks';

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

/** Re-renders every `ms`, for clocks. */
export function useTick(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const PATHS = {
  today: <path d="M3 10h2v4H3zM19 10h2v4h-2zM5 8h3v8H5zM16 8h3v8h-3zM8 12h8" />,
  cards: <><rect x="3" y="6" width="13" height="10" rx="2" /><path d="M8 19h11a2 2 0 002-2v-8" /></>,
  history: <path d="M3 12a9 9 0 109-9 9 9 0 00-6.7 3M3 4v4h4M12 7v5l3 2" />,
  progress: <path d="M3 3v18h18M7 15l4-4 3 3 6-6" />,
  routines: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  hub: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  chevron: <path d="M9 18l6-6-6-6" />,
  back: <path d="M15 18l-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6L9 17l-5-5" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  up: <path d="M18 15l-6-6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" />,
} as const;

export function Icon({ name, class: cls = 'ico' }: { name: keyof typeof PATHS; class?: string }) {
  return <svg viewBox="0 0 24 24" class={cls} aria-hidden="true">{PATHS[name]}</svg>;
}

export function Header({ title, back, actions }: { title: string; back?: { href?: string; label: string; onClick?: () => void }; actions?: ComponentChildren }) {
  return (
    <header class="header">
      {back && (
        <div class="header-inner" style={{ paddingBottom: 0, minHeight: 44 }}>
          {back.href
            ? <a class="back" href={back.href}><Icon name="back" />{back.label}</a>
            : <button type="button" class="back" onClick={back.onClick}><Icon name="back" />{back.label}</button>}
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
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, select, button:not([aria-label="Close"])')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
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

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** A numeric text field that keeps what is typed and reports a number on change. */
export function NumField({ value, onCommit, label, decimals = 1, class: cls = 'num' }: { value: number; onCommit: (n: number) => void; label: string; decimals?: number; class?: string }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value ? String(Math.round(value * 10 ** decimals) / 10 ** decimals) : '');
  return (
    <input
      class={cls}
      inputMode={decimals ? 'decimal' : 'numeric'}
      aria-label={label}
      value={shown}
      placeholder="0"
      onFocus={(e) => (e.currentTarget as HTMLInputElement).select()}
      onInput={(e) => setText((e.currentTarget as HTMLInputElement).value.replace(decimals ? /[^0-9.]/g : /\D/g, ''))}
      onBlur={() => {
        if (text === null) return;
        const n = Number(text);
        onCommit(Number.isFinite(n) ? n : 0);
        setText(null);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
    />
  );
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
