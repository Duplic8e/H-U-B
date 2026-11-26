import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../context';
import { expiryLabel, expiryState, matches, sortItems, today } from '../data/expiry';
import type { Item } from '../data/types';
import { HUB_URL } from '../sync/sync';
import { withUnit } from '../data/meat';
import { CATEGORIES, categoryOf } from '../data/categories';
import { Header, Icon, Stepper, Thumb, useLive } from '../ui/kit';

export function List({ onScan, onAdd, onMeat, onOpen }: { onScan: () => void; onAdd: () => void; onMeat: () => void; onOpen: (item: Item) => void }) {
  const { repo, toast } = useApp();
  const items = useLive(() => repo.listItems());
  const scans = useLive(() => repo.listScans());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const day = today();
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of items ?? []) { const k = categoryOf(i); c.set(k, (c.get(k) ?? 0) + 1); }
    return c;
  }, [items]);
  const shown = useMemo(() => sortItems((items ?? []).filter((i) => matches(i, query) && (!filter || categoryOf(i) === filter))), [items, query, filter]);

  const change = async (item: Item, next: number) => {
    const left = await repo.adjust(item.id, next - item.quantity);
    if (left === 0) toast({ message: `Used up ${item.name || 'item'}`, action: { label: 'Undo', run: () => void repo.restore(item.id) } });
  };

  const total = (items ?? []).reduce((n, i) => n + i.quantity, 0);
  return (
    <>
      <Header title="Pantry" actions={<>
        {HUB_URL && <a class="icon-btn" href={HUB_URL} aria-label="Hub"><Icon name="hub" /></a>}
        <a class="icon-btn" href="#/recipes" aria-label="Recipes"><Icon name="book" /></a>
        <button type="button" class="icon-btn" aria-label="Add an item by hand" onClick={onAdd}><Icon name="plus" /></button>
        <a class="icon-btn" href="#/settings" aria-label="Settings"><Icon name="gear" /></a>
      </>} />
      <div class="page">
        {scans && scans.length > 0 && (
          <div class="banner" role="status">
            <p>{scans.length} scanned {scans.length === 1 ? 'product' : 'products'} to add</p>
            <a class="btn small primary" href="#/groceries">Review</a>
          </div>
        )}
        {items && items.length > 0 && (
          <>
            <input class="input search" type="search" aria-label="Search the pantry" placeholder="Search" value={query} enterkeyhint="search" onInput={(e) => setQuery(e.currentTarget.value)} />
            <div class="cat-row" role="group" aria-label="Categories">
              <button type="button" class="chip" aria-pressed={!filter} onClick={() => setFilter(null)}>All</button>
              {CATEGORIES.filter((c) => counts.has(c.id)).map((c) => (
                <button key={c.id} type="button" class="chip" aria-pressed={filter === c.id} onClick={() => setFilter(filter === c.id ? null : c.id)}>{c.label} <span class="chip-count">{counts.get(c.id)}</span></button>
              ))}
            </div>
          </>
        )}
        {items && items.length === 0 && !scans?.length && (
          <div class="empty" style={{ marginTop: '18vh' }}>
            <p style={{ fontSize: 20, fontWeight: 650, color: 'var(--text)', margin: '0 0 6px' }}>Nothing in the pantry yet</p>
            <p style={{ margin: 0 }}>Scan the barcode on a food item to add it, or tap + to type one in. Unpacking groceries? Switch the scanner to Groceries and scan everything in one go.</p>
          </div>
        )}
        {items && items.length > 0 && shown.length === 0 && <p class="empty">{query.trim() ? `Nothing matches “${query.trim()}”.` : 'Nothing in this category.'}</p>}
        {shown.length > 0 && (
          <>
            <p class="section-label">{query.trim() || filter ? `${shown.length} of ${items?.length ?? 0} products` : `${items?.length ?? 0} ${items?.length === 1 ? 'product' : 'products'}, ${total} ${total === 1 ? 'item' : 'items'}`}</p>
            <ul class="list">
              {shown.map((item) => {
                const state = expiryState(item.expiresOn, day);
                const title = item.name || (item.lookup === 'pending' ? 'Looking up…' : `Barcode ${item.barcode ?? ''}`);
                const waiting = !item.name && item.lookup === 'pending';
                return (
                  <li key={item.id} class="row item">
                    <button type="button" class="item-open" onClick={() => onOpen(item)} aria-label={`Edit ${title}`}>
                      <Thumb name={item.name || '?'} src={item.imageUrl ?? item.photo} />
                      <span class="row-main">
                        <span class={`row-title wrap${item.name ? '' : ' muted'}`}>{title}</span>
                        {!item.name
                          ? <span class={`row-sub${waiting ? '' : ' soon'}`}>{waiting ? `Barcode ${item.barcode ?? ''}` : 'Not in the databases. Tap to name it.'}</span>
                          : item.expiresOn
                            ? <span class={`row-sub ${state === 'ok' ? '' : state}`}>{item.unit ? `${withUnit(item.quantity, item.unit)} · ` : ''}{expiryLabel(item.expiresOn, day)}</span>
                            : (item.unit || item.brand) && <span class="row-sub">{item.unit ? withUnit(item.quantity, item.unit) : item.brand}</span>}
                      </span>
                    </button>
                    <Stepper label={`Quantity of ${title}`} value={item.quantity} onChange={(next) => void change(item, next)} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <div class="actions">
        <div class="actions-inner">
          <button type="button" class="btn primary" aria-label="Scan barcode" onClick={onScan}><Icon name="scan" />Scan</button>
          <button type="button" class="btn add" aria-label="Add chicken or beef" onClick={onMeat}><Icon name="meat" />Meat</button>
          <button type="button" class="btn add icon-only" aria-label="Add by hand" onClick={onAdd}><Icon name="plus" /></button>
        </div>
      </div>
    </>
  );
}
