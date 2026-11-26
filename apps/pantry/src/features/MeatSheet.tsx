import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { today } from '../data/expiry';
import { MEAT, suggestedExpiry, UNITS, withUnit, type MeatKind } from '../data/meat';
import { Sheet, Stepper } from '../ui/kit';

/** Adds fresh chicken or beef: pick the cut, how many, and fridge or freezer. */
export function MeatSheet({ onClose }: { onClose: () => void }) {
  const { repo, toast } = useApp();
  const [kind, setKind] = useState<MeatKind | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pieces');
  const [storage, setStorage] = useState<'fridge' | 'freezer'>('fridge');
  const [expiresOn, setExpiresOn] = useState('');
  const day = today();

  const pick = (k: MeatKind) => {
    setKind(k);
    setUnit(k.unit);
    setQuantity(k.unit === 'pieces' ? 4 : 1);
    setExpiresOn(suggestedExpiry(k, storage, day));
  };
  const place = (s: 'fridge' | 'freezer') => {
    setStorage(s);
    if (kind) setExpiresOn(suggestedExpiry(kind, s, day));
  };
  const save = async (e: Event) => {
    e.preventDefault();
    if (!kind) return;
    const now = await repo.addMeat({ key: kind.key, name: kind.name, quantity, unit, storage, expiresOn: expiresOn || undefined });
    onClose();
    toast({ message: `${kind.name}${storage === 'freezer' ? ' (frozen)' : ''}: ${withUnit(now, unit)}` });
  };

  if (!kind) {
    return (
      <Sheet title="Add meat" onClose={onClose}>
        {(['Chicken', 'Beef'] as const).map((group) => (
          <div key={group}>
            <p class="section-label">{group}</p>
            <div class="meat-grid">
              {MEAT.filter((m) => m.group === group).map((m) => (
                <button key={m.key} type="button" class="meat-btn" onClick={() => pick(m)}>{m.name}</button>
              ))}
            </div>
          </div>
        ))}
      </Sheet>
    );
  }

  return (
    <Sheet title={kind.name} onClose={onClose}>
      <form onSubmit={(e) => void save(e)}>
        <div class="field"><span>How many</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Stepper label="How many" value={quantity} min={1} large onChange={setQuantity} />
            <select class="input" style={{ width: 'auto', flex: 1, minWidth: 120 }} aria-label="Counted in" value={unit} onChange={(e) => setUnit(e.currentTarget.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div class="field"><span>Kept in</span>
          <div class="seg" role="radiogroup" aria-label="Kept in">
            <button type="button" role="radio" aria-checked={storage === 'fridge'} onClick={() => place('fridge')}>Fridge</button>
            <button type="button" role="radio" aria-checked={storage === 'freezer'} onClick={() => place('freezer')}>Freezer</button>
          </div>
        </div>
        <label class="field"><span>Use by</span>
          <input class="input" type="date" value={expiresOn} min={day} onInput={(e) => setExpiresOn(e.currentTarget.value)} />
        </label>
        <p class="muted small" style={{ marginTop: -6 }}>Suggested from food-safety guidance for raw {kind.name.toLowerCase()} in the {storage}. Use the date on the pack if it has one.</p>
        <div class="sheet-actions">
          <button type="submit" class="btn primary block">Add {withUnit(quantity, unit)}</button>
          <button type="button" class="btn block" onClick={() => setKind(null)}>Pick a different cut</button>
        </div>
      </form>
    </Sheet>
  );
}
