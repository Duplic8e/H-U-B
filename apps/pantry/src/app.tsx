import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Ctx, type AppCtx, type Toast } from './context';
import { lookupBarcode } from './data/lookup';
import { getRepo } from './data/repo';
import type { Item } from './data/types';
import { useRoute } from './router';
import { PantrySync } from './sync/sync';
import { ItemSheet, type Draft } from './features/ItemSheet';
import { List } from './features/List';
import { Settings } from './features/Settings';
import { Scanner } from './ui/Scanner';
import { Sheet } from './ui/kit';

const repo = getRepo();
const sync = new PantrySync(repo);

/** The sheet for a barcode that was just read: the item it already is, the product it was, or a fresh lookup. */
async function draftFor(barcode: string): Promise<Draft> {
  const known = await repo.findByBarcode(barcode);
  if (known && !known.deletedAt) return { mode: 'another', existing: known, barcode, name: known.name, brand: known.brand, imageUrl: known.imageUrl, quantity: known.quantity + 1, expiresOn: known.expiresOn };
  if (known) return { mode: 'new', barcode, name: known.name, brand: known.brand, imageUrl: known.imageUrl, quantity: 1 };
  const result = await lookupBarcode(barcode);
  if (result.status === 'found') return { mode: 'new', barcode, ...result.product, quantity: 1 };
  const NOTES = {
    offline: 'Could not look this product up (no connection). Try again, or type its name and Pantry will remember it.',
    incomplete: 'Some product databases could not be reached right now, and the others do not know this barcode. Try again, or type its name.',
    not_found: 'None of the product databases know this barcode. Type its name and Pantry will remember it.',
  } as const;
  return { mode: 'new', barcode, name: '', quantity: 1, note: NOTES[result.status], retry: result.status !== 'not_found' };
}

export function App() {
  const route = useRoute();
  const [message, setMessage] = useState<Toast | null>(null);
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState<string | null>(null);
  /** The barcode being looked up; cleared when that sheet is closed, which cancels the scan. */
  const pending = useRef<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    void sync.start().then((s) => { stop = s; });
    void navigator.storage?.persist?.().catch(() => undefined);
    return () => stop?.();
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.action ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [message]);

  const ctx: AppCtx = useMemo(() => ({ repo, sync, toast: setMessage }), []);

  const onCode = useCallback(async (barcode: string) => {
    setScanning(false);
    pending.current = barcode;
    setLooking(barcode);
    let next: Draft | undefined;
    try { next = await draftFor(barcode); } catch (e) { console.error('Lookup failed', e); }
    if (pending.current !== barcode) return;
    pending.current = null;
    setLooking(null);
    if (next) setDraft(next);
    else setMessage({ message: 'Something went wrong reading that barcode.' });
  }, []);
  const addByHand = useCallback(() => { setScanning(false); setDraft({ mode: 'new', name: '', quantity: 1 }); }, []);
  const open = useCallback((item: Item) => setDraft({ mode: 'edit', existing: item, barcode: item.barcode, name: item.name, brand: item.brand, imageUrl: item.imageUrl, quantity: item.quantity, expiresOn: item.expiresOn }), []);
  const closeScanner = useCallback(() => setScanning(false), []);
  const closeDraft = useCallback(() => setDraft(null), []);
  const closeLooking = useCallback(() => { pending.current = null; setLooking(null); }, []);

  return (
    <Ctx.Provider value={ctx}>
      <div class="app">
        {route === 'settings' ? <Settings /> : <List onScan={() => setScanning(true)} onAdd={addByHand} onOpen={open} />}
        {scanning && <Scanner onCode={(code) => void onCode(code)} onClose={closeScanner} onManual={addByHand} />}
        {looking && <Sheet title="Looking up product" onClose={closeLooking}><p class="empty" role="status">Barcode {looking}…</p></Sheet>}
        {draft && <ItemSheet key={`${draft.mode}:${draft.existing?.id ?? draft.barcode ?? ''}:${draft.note ?? ''}`} draft={draft} onClose={closeDraft} onRetry={draft.retry && draft.barcode ? () => { const code = draft.barcode!; setDraft(null); void onCode(code); } : undefined} />}
        {message && (
          <div class="toast" role="status">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{message.message}</span>
            {message.action && <button type="button" onClick={() => { message.action?.run(); setMessage(null); }}>{message.action.label}</button>}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
