import React, { useId, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { useBudgetStore } from '../../store/useBudgetStore'

const FIELD = 'w-full min-h-[44px] px-3 rounded-[10px] bg-[color-mix(in_srgb,var(--text-secondary)_14%,transparent)] text-[16px] text-text-primary'
const LABEL = 'text-[13px] font-medium uppercase tracking-wide text-text-secondary'
const PRIMARY = 'min-h-[50px] rounded-xl bg-accent text-bg-primary text-[17px] font-semibold disabled:opacity-50'
const NEW_GROUP = '__new-group__'

/** Creates a category, optionally in a new group, without leaving the screen.
 *  `kind` is fixed by what is being filed: spending goes into an expense group,
 *  money in into an income group. */
export const NewCategorySheet: React.FC<{
  open: boolean
  kind: 'income' | 'expense'
  onClose: () => void
  onCreated: (categoryId: string) => void
}> = ({ open, kind, onClose, onCreated }) => (
  <Sheet open={open} onClose={onClose} desktop="modal" ariaLabel="New category" title="New Category" panelClassName="w-full max-w-md">
    {/* Keyed on open, so every opening starts from an empty form. */}
    <NewCategoryForm key={open ? 'open' : 'closed'} kind={kind} onClose={onClose} onCreated={onCreated} />
  </Sheet>
)

const NewCategoryForm: React.FC<{ kind: 'income' | 'expense'; onClose: () => void; onCreated: (categoryId: string) => void }> = ({ kind, onClose, onCreated }) => {
  const groups = useBudgetStore((s) => s.categoryGroups)
  const options = Object.values(groups).filter((g) => g.kind === kind).sort((a, b) => a.name.localeCompare(b.name))
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState(() => options[0]?.id ?? NEW_GROUP)
  const [groupName, setGroupName] = useState('')
  const nameId = useId()
  const groupFieldId = useId()
  const newGroupId = useId()

  const creatingGroup = groupId === NEW_GROUP
  const ready = name.trim() !== '' && (!creatingGroup || groupName.trim() !== '')

  const save = () => {
    if (!ready) return
    const budget = useBudgetStore.getState()
    let parent = groupId
    if (creatingGroup) {
      parent = crypto.randomUUID()
      budget.addCategoryGroup({ id: parent, name: groupName.trim(), kind })
    }
    const id = crypto.randomUUID()
    budget.addCategory({ id, groupId: parent, name: name.trim(), targetAmount: 0 })
    onClose()
    onCreated(id)
  }

  return (
    <form className="flex flex-col gap-4 p-4" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={nameId} className={LABEL}>Category name</label>
        <input id={nameId} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'income' ? 'e.g. Side Gig' : 'e.g. Takeout'} className={FIELD} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={groupFieldId} className={LABEL}>Group</label>
        <select id={groupFieldId} value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`${FIELD} appearance-none`}>
          {options.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value={NEW_GROUP}>+ New group…</option>
        </select>
      </div>
      {creatingGroup && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={newGroupId} className={LABEL}>New group name</label>
          <input id={newGroupId} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={kind === 'income' ? 'e.g. Income' : 'e.g. Food & Dining'} className={FIELD} />
        </div>
      )}
      <button type="submit" disabled={!ready} className={PRIMARY}>Add Category</button>
    </form>
  )
}

/** Renames a category or a group. */
export const RenameSheet: React.FC<{
  open: boolean
  what: 'category' | 'group'
  current: string
  onClose: () => void
  onSave: (name: string) => void
}> = ({ open, what, current, onClose, onSave }) => (
  <Sheet open={open} onClose={onClose} desktop="modal" ariaLabel={`Rename ${what}`} title={`Rename ${what === 'group' ? 'Group' : 'Category'}`} panelClassName="w-full max-w-md">
    <RenameForm key={open ? `open:${current}` : 'closed'} what={what} current={current} onClose={onClose} onSave={onSave} />
  </Sheet>
)

const RenameForm: React.FC<{ what: 'category' | 'group'; current: string; onClose: () => void; onSave: (name: string) => void }> = ({ what, current, onClose, onSave }) => {
  const [name, setName] = useState(current)
  const inputId = useId()
  const ready = name.trim() !== '' && name.trim() !== current
  return (
    <form className="flex flex-col gap-4 p-4" onSubmit={(e) => { e.preventDefault(); if (ready) { onSave(name.trim()); onClose() } }}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className={LABEL}>{what === 'group' ? 'Group name' : 'Category name'}</label>
        <input id={inputId} autoFocus value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
      </div>
      <button type="submit" disabled={!ready} className={PRIMARY}>Save</button>
    </form>
  )
}
