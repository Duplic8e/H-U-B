import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { APPLIANCES } from '../data/appliances';
import { Icon, Sheet } from '../ui/kit';

/** Pick the appliances in this kitchen; recipe ideas then use only those. */
export function AppliancesSheet({ current, onClose }: { current: string[]; onClose: () => void }) {
  const { repo, toast } = useApp();
  const [chosen, setChosen] = useState(new Set(current));
  const [other, setOther] = useState('');
  const options = [...APPLIANCES, ...current.filter((a) => !APPLIANCES.includes(a))];
  const toggle = (a: string) => { const next = new Set(chosen); if (next.has(a)) next.delete(a); else next.add(a); setChosen(next); };
  const addOther = () => { const a = other.trim(); if (!a) return; setChosen(new Set([...chosen, a])); setOther(''); };
  const save = async () => {
    await repo.setAppliances(options.filter((a) => chosen.has(a)).concat([...chosen].filter((a) => !options.includes(a))));
    onClose();
    toast({ message: chosen.size ? `Recipes will use only your ${chosen.size} appliances` : 'Recipes may use any appliance' });
  };
  const all = [...options, ...[...chosen].filter((a) => !options.includes(a))];
  return (
    <Sheet title="Your appliances" onClose={onClose}>
      <p class="muted" style={{ marginTop: 0 }}>Recipe ideas will only use what you tick here. Hand tools like pots, pans and knives are always assumed.</p>
      <div class="chips" role="group" aria-label="Appliances">
        {all.map((a) => (
          <button key={a} type="button" class="chip" aria-pressed={chosen.has(a)} onClick={() => toggle(a)}>{chosen.has(a) && <Icon name="check" />}{a}</button>
        ))}
      </div>
      <div class="key-row" style={{ marginTop: 14 }}>
        <input class="input" aria-label="Another appliance" placeholder="Another appliance" value={other} onInput={(e) => setOther(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } }} />
        <button type="button" class="btn small" style={{ minHeight: 44 }} disabled={!other.trim()} onClick={addOther}>Add</button>
      </div>
      <div class="sheet-actions" style={{ marginTop: 16 }}>
        <button type="button" class="btn primary block" onClick={() => void save()}>Save</button>
      </div>
    </Sheet>
  );
}
