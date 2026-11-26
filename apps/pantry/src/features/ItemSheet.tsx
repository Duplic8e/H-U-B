import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../context';
import { today } from '../data/expiry';
import { forgetLookup, lookupOnce, type LookupResult } from '../data/lookup';
import type { Nutrition } from '../data/nutrition';
import type { Item } from '../data/types';
import { Sheet, Stepper, Thumb } from '../ui/kit';
import { NutritionFacts } from '../ui/NutritionFacts';

/** What the sheet hands back when it edits something other than a pantry item. */
export interface SheetValues { name: string; brand: string; quantity: number; expiresOn: string }

/** What the sheet starts from: an item in the pantry, a product just scanned, or nothing. */
export interface Draft {
  /** Set when this edits an item already in the pantry. */
  existing?: Item;
  barcode?: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  quantity: number;
  expiresOn?: string;
  nutrition?: Nutrition;
  /** Look the barcode up while the sheet is open, filling in what the user has not typed. */
  lookUp?: boolean;
  /** How the sheet was reached, for its title and button. */
  mode: 'new' | 'another' | 'edit' | 'scan';
}

const TITLE = { new: 'Add to pantry', another: 'Add another', edit: 'Edit item', scan: 'Scanned item' } as const;

const NOTES = {
  offline: 'Could not look this product up (no connection). Save it anyway and Pantry will look it up when you are back online, or type its name.',
  incomplete: 'Some product databases could not be reached, and the others do not know this barcode. Save it anyway and Pantry will keep trying, or type its name.',
  not_found: 'None of the product databases know this barcode. Type its name and Pantry will remember it.',
} as const;

export function ItemSheet({ draft, onClose, onSave, onRemove }: {
  draft: Draft;
  onClose: () => void;
  /** Replaces saving to the pantry (groceries review edits its list instead). */
  onSave?: (values: SheetValues) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const { repo, toast } = useApp();
  const [nutrition, setNutrition] = useState(draft.nutrition);
  const [imageUrl, setImageUrl] = useState(draft.imageUrl);
  const [result, setResult] = useState<LookupResult | 'looking' | undefined>(draft.lookUp && draft.barcode ? 'looking' : undefined);
  /** Fields the user has typed in; a late lookup leaves them alone. */
  const touched = useRef({ name: false, brand: false });
  const [attempt, setAttempt] = useState(0);
  // The lookup runs while the sheet is open; whatever comes back fills the fields not typed in.
  useEffect(() => {
    if (!draft.lookUp || !draft.barcode) return;
    let live = true;
    setResult('looking');
    void lookupOnce(draft.barcode).then((r) => {
      if (!live) return;
      setResult(r);
      if (r.status !== 'found') return;
      const p = r.product;
      if (!touched.current.name) setName((n) => n || p.name);
      if (!touched.current.brand) setBrand((b) => b || p.brand || '');
      setImageUrl((u) => u ?? p.imageUrl);
      setNutrition((n) => n ?? p.nutrition);
    });
    return () => { live = false; };
  }, [draft.lookUp, draft.barcode, attempt]);
  // Items saved before Pantry read nutrition get it the first time they are opened online.
  useEffect(() => {
    if (draft.nutrition || !draft.barcode || draft.mode !== 'edit' || draft.lookUp) return;
    let live = true;
    void lookupOnce(draft.barcode).then((r) => {
      const n = r.status === 'found' ? r.product.nutrition : undefined;
      if (!live || !n) return;
      setNutrition(n);
      if (draft.existing) void repo.setNutrition(draft.existing.id, n);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [draft, repo]);
  const [name, setName] = useState(draft.name);
  const [brand, setBrand] = useState(draft.brand ?? '');
  const [quantity, setQuantity] = useState(draft.quantity);
  const [expiresOn, setExpiresOn] = useState(draft.expiresOn ?? '');
  const trimmed = name.trim();

  const notFound = result !== 'looking' && result?.status === 'not_found';
  // A scanned product can be saved before it has a name: the lookup finishes in the background.
  const canSave = !!trimmed || !!draft.barcode;
  const save = async (e: Event) => {
    e.preventDefault();
    if (!canSave) return;
    if (onSave) { await onSave({ name: trimmed, brand, quantity, expiresOn }); onClose(); return; }
    await repo.saveItem({
      id: draft.existing?.id, barcode: draft.barcode, name: trimmed, brand, imageUrl, quantity, expiresOn, unit: draft.existing?.unit, storage: draft.existing?.storage,
      nutrition: nutrition ?? draft.existing?.nutrition, lookup: notFound ? 'not_found' : 'pending',
    });
    onClose();
    if (draft.mode === 'edit') return;
    if (draft.mode === 'another') toast({ message: `${trimmed}: now ${quantity}` });
    else if (trimmed) toast({ message: `Added ${trimmed}` });
    else toast({ message: notFound ? 'Added. Tap it in the list to name it.' : 'Added. Looking it up in the background.' });
  };

  const remove = async () => {
    if (onRemove) { await onRemove(); onClose(); return; }
    const item = draft.existing;
    if (!item) return;
    await repo.remove(item.id);
    onClose();
    toast({ message: `Removed ${item.name}`, action: { label: 'Undo', run: () => void repo.restore(item.id) } });
  };

  return (
    <Sheet title={TITLE[draft.mode]} onClose={onClose}>
      <form onSubmit={(e) => void save(e)}>
        <div class="product">
          <Thumb name={trimmed || '?'} src={imageUrl} big />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 17 }}>{trimmed || (result === 'looking' ? 'Looking up…' : 'New item')}</p>
            <p class="muted small">{draft.barcode ? `Barcode ${draft.barcode}` : 'No barcode'}</p>
          </div>
        </div>
        {result && result !== 'looking' && result.status !== 'found' && !trimmed && (
          <div class="note" role="status">
            <p style={{ margin: 0 }}>{NOTES[result.status]}</p>
            {result.status !== 'not_found' && <button type="button" class="btn small" style={{ marginTop: 10 }} onClick={() => { if (draft.barcode) forgetLookup(draft.barcode); setAttempt((a) => a + 1); }}>Try again</button>}
          </div>
        )}
        <label class="field"><span>Name</span>
          <input class="input" value={name} required={!draft.barcode} autocomplete="off" autocapitalize="sentences" enterkeyhint="done"
            placeholder={result === 'looking' ? 'Looking up… (you can save now)' : 'e.g. Chopped tomatoes'} autofocus={!draft.name && !draft.barcode}
            onInput={(e) => { setName(e.currentTarget.value); touched.current.name = true; }} />
        </label>
        <label class="field"><span>Brand (optional)</span>
          <input class="input" value={brand} autocomplete="off" autocapitalize="words" enterkeyhint="done" onInput={(e) => { setBrand(e.currentTarget.value); touched.current.brand = true; }} />
        </label>
        <div class="field"><span>Quantity{draft.existing?.unit ? ` (${draft.existing.unit})` : ''}</span>
          <Stepper label="Quantity" value={quantity} min={1} large onChange={setQuantity} />
        </div>
        <label class="field"><span>Expiry date (optional)</span>
          <div class="date-row">
            <input class="input" type="date" value={expiresOn} min={draft.mode === 'edit' ? undefined : today()} onInput={(e) => setExpiresOn(e.currentTarget.value)} />
            {expiresOn && <button type="button" class="btn small" style={{ minHeight: 44 }} onClick={() => setExpiresOn('')}>Clear</button>}
          </div>
        </label>
        <div class="sheet-actions">
          <button type="submit" class="btn primary block" disabled={!canSave}>{draft.mode === 'edit' || draft.mode === 'scan' ? 'Save' : draft.mode === 'another' ? `Save, ${quantity} in pantry` : 'Add to pantry'}</button>
          {(draft.existing || onRemove) && <button type="button" class="btn danger block" onClick={() => void remove()}>{onRemove ? 'Remove from list' : 'Remove from pantry'}</button>}
        </div>
        {nutrition && <div style={{ marginTop: 20 }}><NutritionFacts nutrition={nutrition} /></div>}
      </form>
    </Sheet>
  );
}
