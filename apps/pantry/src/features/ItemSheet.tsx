import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { today } from '../data/expiry';
import type { Item } from '../data/types';
import { Sheet, Stepper, Thumb } from '../ui/kit';

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
  /** Shown above the form, e.g. why the name is blank. */
  note?: string;
  /** The lookup could not reach every database, so it is worth asking again. */
  retry?: boolean;
  /** How the sheet was reached, for its title and button. */
  mode: 'new' | 'another' | 'edit';
}

const TITLE = { new: 'Add to pantry', another: 'Add another', edit: 'Edit item' } as const;

export function ItemSheet({ draft, onClose, onRetry }: { draft: Draft; onClose: () => void; onRetry?: () => void }) {
  const { repo, toast } = useApp();
  const [name, setName] = useState(draft.name);
  const [brand, setBrand] = useState(draft.brand ?? '');
  const [quantity, setQuantity] = useState(draft.quantity);
  const [expiresOn, setExpiresOn] = useState(draft.expiresOn ?? '');
  const trimmed = name.trim();

  const save = async (e: Event) => {
    e.preventDefault();
    if (!trimmed) return;
    await repo.saveItem({ id: draft.existing?.id, barcode: draft.barcode, name: trimmed, brand, imageUrl: draft.imageUrl, quantity, expiresOn });
    onClose();
    if (draft.mode !== 'edit') toast({ message: draft.mode === 'another' ? `${trimmed}: now ${quantity}` : `Added ${trimmed}` });
  };

  const remove = async () => {
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
          <Thumb name={trimmed} src={draft.imageUrl} big />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 17 }}>{trimmed || 'New item'}</p>
            <p class="muted small">{draft.barcode ? `Barcode ${draft.barcode}` : 'No barcode'}</p>
          </div>
        </div>
        {draft.note && (
          <div class="note" role="status">
            <p style={{ margin: 0 }}>{draft.note}</p>
            {onRetry && <button type="button" class="btn small" style={{ marginTop: 10 }} onClick={onRetry}>Try again</button>}
          </div>
        )}
        <label class="field"><span>Name</span>
          <input class="input" value={name} required autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="e.g. Chopped tomatoes" autofocus={!draft.name} onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <label class="field"><span>Brand (optional)</span>
          <input class="input" value={brand} autocomplete="off" autocapitalize="words" enterkeyhint="done" onInput={(e) => setBrand(e.currentTarget.value)} />
        </label>
        <div class="field"><span>Quantity</span>
          <Stepper label="Quantity" value={quantity} min={1} large onChange={setQuantity} />
        </div>
        <label class="field"><span>Expiry date (optional)</span>
          <div class="date-row">
            <input class="input" type="date" value={expiresOn} min={draft.mode === 'edit' ? undefined : today()} onInput={(e) => setExpiresOn(e.currentTarget.value)} />
            {expiresOn && <button type="button" class="btn small" style={{ minHeight: 44 }} onClick={() => setExpiresOn('')}>Clear</button>}
          </div>
        </label>
        <div class="sheet-actions">
          <button type="submit" class="btn primary block" disabled={!trimmed}>{draft.mode === 'edit' ? 'Save' : draft.mode === 'another' ? `Save, ${quantity} in pantry` : 'Add to pantry'}</button>
          {draft.existing && <button type="button" class="btn danger block" onClick={() => void remove()}>Remove from pantry</button>}
        </div>
      </form>
    </Sheet>
  );
}
