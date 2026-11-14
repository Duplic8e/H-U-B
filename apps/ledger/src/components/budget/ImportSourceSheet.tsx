import { useId, useState } from 'react'
import { useTriageStore } from '../../store/useTriageStore'
import { Sheet } from '../ui/Sheet'
import { ThemedSelect } from '../ui/ThemedSelect'

export function ImportSourceSheet({ onImport, onClose, bankSource, reservedBindings = {} }: {
  onImport: (choice: { sourceId?: string; name?: string }) => void;
  onClose: () => void;
  bankSource?: { key: string; name: string };
  reservedBindings?: Record<string, string>;
}) {
  const sources = useTriageStore(state => state.importSources)
  const eligible = Object.values(sources).filter(source => !bankSource ||
    ((!source.bankKey || source.bankKey === bankSource.key) &&
      (!reservedBindings[source.id] || reservedBindings[source.id] === bankSource.key)))
  const [selected, setSelected] = useState(eligible.length ? '' : 'new')
  const [name, setName] = useState(bankSource?.name ?? '')
  const nameId = useId()
  return (
    <Sheet open onClose={onClose} ariaLabel="Choose Import Source" title="Choose Import Source"
      panelClassName="desktop:p-6 desktop:rounded-lg desktop:w-[420px] bg-bg-primary border border-border shadow-xl"
      contentClassName="flex flex-col gap-4">
      <h2 className="hidden desktop:block text-[18px] font-semibold">Choose Import Source</h2>
      <p className="text-[14px] text-text-secondary">{bankSource ? `${bankSource.name} recognized. Choose its existing source or create a new one.` : 'Which card or account is this file from? Use the same source for future statements.'}</p>
      <ThemedSelect value={selected} onChange={setSelected} ariaLabel="Import source" options={[
        { value: '', label: 'Choose a card or account' },
        ...eligible.map(source => ({ value: source.id, label: source.name })),
        { value: 'new', label: 'New card or account' },
      ]} />
      {selected === 'new' && <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-[13px]">Card or account name</label>
        <input id={nameId} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. My credit card"
          className="h-11 w-full rounded-md border border-border bg-bg-secondary px-3 text-[14px]" />
      </div>}
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="min-h-11 px-3 rounded-md border border-border text-[14px]">Cancel</button>
        <button disabled={!selected || (selected === 'new' && !name.trim())}
          onClick={() => onImport(selected === 'new' ? { name: name.trim() } : { sourceId: selected })}
          className="min-h-11 px-3 rounded-md bg-accent text-bg-primary text-[14px] disabled:opacity-50">Import transactions</button>
      </div>
    </Sheet>
  )
}
