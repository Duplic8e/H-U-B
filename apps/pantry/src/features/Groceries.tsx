import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { barcodeId } from '../data/barcode';
import { expiryLabel, today } from '../data/expiry';
import type { Item, Scan } from '../data/types';
import { Header, Icon, Stepper, Thumb, useLive } from '../ui/kit';
import { ItemSheet } from './ItemSheet';

function status(scan: Scan, inPantry: Item | undefined, day: string): { text: string; tone?: 'soon' | 'ok' } {
  if (scan.lookup === undefined) return { text: 'Looking up…' };
  if (!scan.name.trim()) {
    if (scan.lookup === 'not_found') return { text: 'Not in the databases. Tap to name it.', tone: 'soon' };
    return { text: 'Could not look it up. Tap to name it, or try again.', tone: 'soon' };
  }
  const parts = [];
  if (inPantry) parts.push(`In pantry: ${inPantry.quantity} → ${inPantry.quantity + scan.count}`);
  else if (scan.brand) parts.push(scan.brand);
  if (scan.expiresOn) parts.push(expiryLabel(scan.expiresOn, day));
  return { text: parts.join(' · ') || 'New', tone: inPantry ? 'ok' : undefined };
}

/** Everything scanned in groceries mode: check it, fix what was not found, then add it all at once. */
export function Groceries({ onScanMore }: { onScanMore: () => void }) {
  const { repo, toast } = useApp();
  const scans = useLive(() => repo.listScans());
  const items = useLive(() => repo.listItems());
  const [editing, setEditing] = useState<Scan | null>(null);
  const day = today();
  if (!scans) return null;

  const pantry = new Map((items ?? []).map((i) => [i.id, i]));
  const pending = scans.filter((s) => s.lookup === undefined).length;
  const unnamed = scans.filter((s) => s.lookup !== undefined && !s.name.trim());
  const retryable = scans.filter((s) => (s.lookup === 'incomplete' || s.lookup === 'offline') && !s.name.trim());
  const ready = scans.filter((s) => s.name.trim());
  const packs = ready.reduce((n, s) => n + s.count, 0);

  const addAll = async () => {
    const { added, left } = await repo.addScansToPantry();
    toast({ message: left ? `Added ${added} to the pantry. ${left} still need a name.` : `Added ${added} ${added === 1 ? 'item' : 'items'} to the pantry` });
    if (!left) location.hash = '#/';
  };
  const clearAll = async () => {
    if (!confirm(`Remove all ${scans.length} scanned items from this list? Nothing is added to the pantry.`)) return;
    await repo.clearScans();
    location.hash = '#/';
  };

  return (
    <>
      <Header title="Groceries" back={{ href: '#/', label: 'Pantry' }} actions={scans.length > 0 && <button type="button" class="link-btn" style={{ paddingRight: 8 }} onClick={() => void clearAll()}>Clear</button>} />
      <div class="page">
        {scans.length === 0 ? (
          <div class="empty" style={{ marginTop: '18vh' }}>
            <p style={{ fontSize: 20, fontWeight: 650, color: 'var(--text)', margin: '0 0 6px' }}>No groceries scanned</p>
            <p style={{ margin: 0 }}>Scan everything from your bags in one go, then add it all here.</p>
          </div>
        ) : (
          <>
            <p class="review-status" role="status">
              {pending ? `Looking up ${pending} of ${scans.length}…` : `${scans.length} ${scans.length === 1 ? 'product' : 'products'}${unnamed.length ? `, ${unnamed.length} need${unnamed.length === 1 ? 's' : ''} a name` : ''}`}
            </p>
            {retryable.length > 0 && !pending && (
              <div class="note" style={{ marginTop: 12 }}>
                <p style={{ margin: 0 }}>{retryable.length === 1 ? 'One product' : `${retryable.length} products`} could not be looked up (the databases could not be reached).</p>
                <button type="button" class="btn small" style={{ marginTop: 10 }} onClick={() => { for (const s of retryable) void repo.updateScan(s.barcode, { lookup: undefined }); }}>Try again</button>
              </div>
            )}
            <ul class="list" style={{ marginTop: 12 }}>
              {scans.map((scan) => {
                const st = status(scan, pantry.get(barcodeId(scan.barcode)), day);
                return (
                  <li key={scan.barcode} class="row item">
                    <button type="button" class="item-open" onClick={() => setEditing(scan)} aria-label={`Edit ${scan.name || `barcode ${scan.barcode}`}`}>
                      <Thumb name={scan.name || '?'} src={scan.imageUrl} />
                      <span class="row-main">
                        <span class="row-title wrap">{scan.name || `Barcode ${scan.barcode}`}</span>
                        <span class={`row-sub ${st.tone ?? ''}`}>{st.text}</span>
                      </span>
                    </button>
                    <Stepper label={`How many of ${scan.name || scan.barcode}`} value={scan.count} min={1} onChange={(count) => void repo.updateScan(scan.barcode, { count })} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <div class="actions">
        <div class="actions-inner">
          {scans.length > 0 && <button type="button" class="btn primary" disabled={!packs} onClick={() => void addAll()}>{packs ? `Add ${packs} to pantry` : 'Name items to add them'}</button>}
          <button type="button" class={`btn ${scans.length ? 'add' : 'primary'}`} onClick={onScanMore}><Icon name="scan" />{scans.length ? 'More' : 'Scan groceries'}</button>
        </div>
      </div>
      {editing && (
        <ItemSheet
          key={editing.barcode}
          draft={{ mode: 'scan', barcode: editing.barcode, name: editing.name, brand: editing.brand, imageUrl: editing.imageUrl, quantity: editing.count, expiresOn: editing.expiresOn, nutrition: editing.nutrition }}
          onClose={() => setEditing(null)}
          onSave={async (v) => repo.updateScan(editing.barcode, { name: v.name, brand: v.brand.trim() || undefined, count: v.quantity, expiresOn: v.expiresOn || undefined, edited: v.name !== editing.name || (v.brand.trim() || undefined) !== editing.brand || editing.edited })}
          onRemove={async () => repo.removeScan(editing.barcode)}
        />
      )}
    </>
  );
}
