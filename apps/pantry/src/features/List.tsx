import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../context';
import { expiryLabel, expiryState, matches, sortItems, today } from '../data/expiry';
import type { Item } from '../data/types';
import { HUB_URL } from '../sync/sync';
import { Header, Icon, Stepper, Thumb, useLive } from '../ui/kit';

export function List({ onScan, onAdd, onOpen }: { onScan: () => void; onAdd: () => void; onOpen: (item: Item) => void }) {
  const { repo, toast } = useApp();
  const items = useLive(() => repo.listItems());
  const [query, setQuery] = useState('');
  const day = today();
  const shown = useMemo(() => sortItems((items ?? []).filter((i) => matches(i, query))), [items, query]);

  const change = async (item: Item, next: number) => {
    const left = await repo.adjust(item.id, next - item.quantity);
    if (left === 0) toast({ message: `Used up ${item.name}`, action: { label: 'Undo', run: () => void repo.restore(item.id) } });
  };

  const total = (items ?? []).reduce((n, i) => n + i.quantity, 0);
  return (
    <>
      <Header title="Pantry" actions={<>
        {HUB_URL && <a class="icon-btn" href={HUB_URL} aria-label="Hub"><Icon name="hub" /></a>}
        <a class="icon-btn" href="#/settings" aria-label="Settings"><Icon name="gear" /></a>
      </>} />
      <div class="page">
        {items && items.length > 0 && (
          <input class="input search" type="search" aria-label="Search the pantry" placeholder="Search" value={query} enterkeyhint="search" onInput={(e) => setQuery(e.currentTarget.value)} />
        )}
        {items && items.length === 0 && (
          <div class="empty" style={{ marginTop: '18vh' }}>
            <p style={{ fontSize: 20, fontWeight: 650, color: 'var(--text)', margin: '0 0 6px' }}>Nothing in the pantry yet</p>
            <p style={{ margin: 0 }}>Scan the barcode on a food item to add it.</p>
          </div>
        )}
        {items && items.length > 0 && shown.length === 0 && <p class="empty">Nothing matches “{query.trim()}”.</p>}
        {shown.length > 0 && (
          <>
            <p class="section-label">{query.trim() ? `${shown.length} of ${items?.length ?? 0} products` : `${items?.length ?? 0} ${items?.length === 1 ? 'product' : 'products'}, ${total} ${total === 1 ? 'item' : 'items'}`}</p>
            <ul class="list">
              {shown.map((item) => {
                const state = expiryState(item.expiresOn, day);
                return (
                  <li key={item.id} class="row item">
                    <button type="button" class="item-open" onClick={() => onOpen(item)} aria-label={`Edit ${item.name}`}>
                      <Thumb name={item.name} src={item.imageUrl} />
                      <span class="row-main">
                        <span class="row-title wrap">{item.name}</span>
                        {item.expiresOn
                          ? <span class={`row-sub ${state === 'ok' ? '' : state}`}>{expiryLabel(item.expiresOn, day)}</span>
                          : item.brand && <span class="row-sub">{item.brand}</span>}
                      </span>
                    </button>
                    <Stepper label={`Quantity of ${item.name}`} value={item.quantity} onChange={(next) => void change(item, next)} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <div class="actions">
        <div class="actions-inner">
          <button type="button" class="btn primary" onClick={onScan}><Icon name="scan" />Scan barcode</button>
          <button type="button" class="btn add" aria-label="Add by hand" onClick={onAdd}><Icon name="plus" /></button>
        </div>
      </div>
    </>
  );
}
