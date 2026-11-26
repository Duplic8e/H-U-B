import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { Ctx, type AppCtx, type Toast } from './context';
import { getRepo } from './data/repo';
import type { Item } from './data/types';
import { useRoute } from './router';
import { PantrySync } from './sync/sync';
import { ItemSheet, type Draft } from './features/ItemSheet';
import { List } from './features/List';
import { Settings } from './features/Settings';
import { Scanner, type Batch, type Removal, type ScanMode } from './ui/Scanner';
import { unlockSound } from './ui/beep';
import { Groceries } from './features/Groceries';
import { Recipes } from './features/Recipes';
import { MeatSheet } from './features/MeatSheet';
import { GroceryLookups, ItemLookups } from './data/groceryLookups';
import { useLive } from './ui/kit';

const repo = getRepo();
const sync = new PantrySync(repo);
const groceryLookups = new GroceryLookups(repo);
const itemLookups = new ItemLookups(repo);

const MODE_KEY = 'pantry-scan-mode';
const savedMode = (): ScanMode => { try { const m = localStorage.getItem(MODE_KEY); return m === 'many' || m === 'remove' ? m : 'one'; } catch { return 'one'; } };

/** The sheet for a barcode that was just read: the item it already is, the product it was, or a new
 *  one that looks itself up while the sheet is open. Never waits on the network. */
async function draftFor(barcode: string, photo?: string): Promise<Draft> {
  const known = await repo.findByBarcode(barcode);
  if (known && !known.deletedAt) return { mode: 'another', existing: known, barcode, name: known.name, brand: known.brand, imageUrl: known.imageUrl, quantity: known.quantity + 1, expiresOn: known.expiresOn, nutrition: known.nutrition, lookUp: known.lookup === 'pending' };
  if (known?.name) return { mode: 'new', barcode, name: known.name, brand: known.brand, imageUrl: known.imageUrl, photo: known.photo, category: known.category, quantity: 1, nutrition: known.nutrition };
  return { mode: 'new', barcode, name: '', quantity: 1, lookUp: true, photo };
}

export function App() {
  const route = useRoute();
  const [message, setMessage] = useState<Toast | null>(null);
  const [scanning, setScanning] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [meat, setMeat] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>(savedMode);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const scans = useLive(() => repo.listScans());
  useEffect(() => { if (scans) groceryLookups.update(scans); }, [scans]);
  const items = useLive(() => repo.listItems());
  useEffect(() => { if (items) itemLookups.update(items); }, [items]);
  // Lookups that could not reach the databases are tried again when the connection comes back
  // and when the app is reopened.
  useEffect(() => {
    const again = () => {
      itemLookups.retry();
      void repo.listScans().then((all) => { for (const s of all) if (s.lookup === 'incomplete' || s.lookup === 'offline') void repo.updateScan(s.barcode, { lookup: undefined }); });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') again(); };
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('online', again); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

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

  const onCode = useCallback(async (barcode: string, photo?: string) => {
    setScanning(false);
    try { setDraft(await draftFor(barcode, photo)); } catch (e) {
      console.error('Reading the pantry failed', e);
      setMessage({ message: 'Something went wrong reading that barcode.' });
    }
  }, []);
  const changeMode = useCallback((mode: ScanMode) => {
    setScanMode(mode);
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* remembered for this visit only */ }
  }, []);
  const onBatchCode = useCallback((barcode: string, photo?: string) => { setLastScan(barcode); void repo.addScan(barcode, photo); }, []);
  const [removal, setRemoval] = useState<Removal>();
  const onRemoveCode = useCallback(async (barcode: string) => {
    const done = await repo.useUpByBarcode(barcode);
    if (!done) { setRemoval({ text: `Not in your pantry (${barcode})`, tone: 'warn' }); return; }
    const name = done.item.name || `Barcode ${barcode}`;
    setRemoval({
      text: done.left ? `${name}: ${done.left} left` : `${name}: used up`, tone: 'ok',
      undo: () => { void repo.undoUseUp(done.item.id); setRemoval({ text: `Put back ${name}`, tone: 'ok' }); },
    });
  }, []);
  const startScan = useCallback(() => { unlockSound(); setLastScan(null); setRemoval(undefined); setScanning(true); }, []);
  const review = useCallback(() => { setScanning(false); location.hash = '#/groceries'; }, []);
  const last = scans?.find((s) => s.barcode === lastScan);
  const batch: Batch = {
    count: (scans ?? []).reduce((n, s) => n + s.count, 0),
    last: last ? { name: last.name || (last.lookup === undefined ? 'Looking up…' : `Barcode ${last.barcode}`), count: last.count } : undefined,
  };
  const addByHand = useCallback(() => { setScanning(false); setDraft({ mode: 'new', name: '', quantity: 1 }); }, []);
  const open = useCallback((item: Item) => setDraft({ mode: 'edit', existing: item, barcode: item.barcode, name: item.name, brand: item.brand, imageUrl: item.imageUrl, photo: item.photo, category: item.category, quantity: item.quantity, expiresOn: item.expiresOn, nutrition: item.nutrition, lookUp: item.lookup === 'pending' }), []);
  const closeScanner = useCallback(() => setScanning(false), []);
  const closeDraft = useCallback(() => setDraft(null), []);

  return (
    <Ctx.Provider value={ctx}>
      <div class="app">
        {route === 'settings' ? <Settings /> : route === 'recipes' ? <Recipes /> : route === 'groceries' ? <Groceries onScanMore={() => { changeMode('many'); startScan(); }} /> : <List onScan={startScan} onAdd={addByHand} onMeat={() => setMeat(true)} onOpen={open} />}
        {meat && <MeatSheet onClose={() => setMeat(false)} />}
        {scanning && <Scanner mode={scanMode} onMode={changeMode} onCode={(code, photo) => void onCode(code, photo)} onBatchCode={onBatchCode} onRemoveCode={(code) => void onRemoveCode(code)} removal={removal} batch={batch} onReview={review} onClose={closeScanner} onManual={addByHand} />}
        {draft && <ItemSheet key={`${draft.mode}:${draft.existing?.id ?? draft.barcode ?? ''}`} draft={draft} onClose={closeDraft} />}
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
