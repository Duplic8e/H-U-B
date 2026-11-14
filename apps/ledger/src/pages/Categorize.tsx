import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, ListChecks, Plus } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { useTriageStore } from '../store/useTriageStore'
import { useBudgetStore } from '../store/useBudgetStore'
import { useUndoStore } from '../store/useUndoStore'
import { captureTriageUndo } from '../utils/budget/triageUndo'
import { GROUP_SORTS, buildMerchantGroups, isQueueRow, monthsBefore, sortGroups, type GroupSort, type MerchantGroup } from '../utils/budget/categorizeQueue'
import { formatMoneyWithCents } from '../components/planner/format'
import { NewCategorySheet } from '../components/budget/CategoryEditSheets'
import type { Category, CategoryGroup } from '../types/budget'
import type { TriageTransaction } from '../types/triage'
import { STORAGE_KEYS } from '../store/storageKeys'

type Window = '3m' | 'all'

const IGNORE = '__not-spending__'
const NEW_CATEGORY = '__new-category__'

/** The last sort picked, remembered on this device only. */
const SORT_KEY = STORAGE_KEYS.categorizeSort

function savedSort(): GroupSort {
  try {
    const value = localStorage.getItem(SORT_KEY)
    return GROUP_SORTS.some((s) => s.value === value) ? (value as GroupSort) : 'newest'
  } catch {
    return 'newest'
  }
}

function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: y === new Date().getFullYear() ? undefined : 'numeric' })
}

/** Native select, grouped by category group, so an iPhone shows its own wheel
 *  picker, with an Add button beside it for a category that does not exist yet. */
const CategorySelect: React.FC<{
  type: 'income' | 'expense'
  label: string
  categories: Record<string, Category>
  groups: Record<string, CategoryGroup>
  value?: string
  onChoose: (categoryId: string) => void
  onNew: () => void
  allowIgnore?: boolean
}> = ({ type, label, categories, groups, value, onChoose, onNew, allowIgnore }) => {
  const byGroup = Object.values(groups)
    .filter((g) => g.kind === type)
    .map((g) => ({ group: g, items: Object.values(categories).filter((c) => c.groupId === g.id).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.items.length > 0)
  return (
    <div className="flex gap-2">
      <select
        aria-label={label}
        value=""
        onChange={(e) => {
          const choice = e.target.value
          if (choice === NEW_CATEGORY) onNew()
          else if (choice) onChoose(choice)
        }}
        className="flex-1 min-w-0 min-h-[44px] rounded-[10px] px-3 bg-[color-mix(in_srgb,var(--text-secondary)_14%,transparent)] text-[16px] font-medium text-accent appearance-none"
      >
        <option value="" disabled>{value && categories[value] ? `Suggested: ${categories[value].name}` : byGroup.length ? 'Choose a category…' : 'No categories yet'}</option>
        {value && categories[value] && <option value={value}>✓ {categories[value].name}</option>}
        {byGroup.map(({ group, items }) => (
          <optgroup key={group.id} label={group.name}>
            {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        ))}
        <option value={NEW_CATEGORY}>+ New category…</option>
        {allowIgnore && <option value={IGNORE}>Not spending (transfer, payment…)</option>}
      </select>
      <button
        type="button"
        onClick={onNew}
        aria-label={`New category for ${label.replace(/^Category for /, '')}`}
        className="shrink-0 w-11 min-h-[44px] rounded-[10px] flex items-center justify-center bg-[color-mix(in_srgb,var(--text-secondary)_14%,transparent)] text-accent"
      >
        <Plus className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  )
}

/** Work through imported transactions one merchant at a time. Choosing a
 *  category files every transaction from that merchant and remembers it, so
 *  the merchant is filed automatically from then on, in the queue and in
 *  every later import. */
export const Categorize: React.FC = () => {
  const pendingTransactions = useTriageStore((s) => s.pendingTransactions)
  const categories = useBudgetStore((s) => s.categories)
  const categoryGroups = useBudgetStore((s) => s.categoryGroups)
  const [windowChoice, setWindowChoice] = useState<Window>('3m')
  const [sort, setSortState] = useState<GroupSort>(savedSort)
  const setSort = (next: GroupSort) => {
    setSortState(next)
    try { localStorage.setItem(SORT_KEY, next) } catch { /* private mode: just not remembered */ }
  }
  const [open, setOpen] = useState<string | null>(null)
  const [filedThisVisit, setFiledThisVisit] = useState(0)
  /** The rows a new category is being made for; they are filed into it on save. */
  const [creating, setCreating] = useState<{ kind: 'income' | 'expense'; apply: (categoryId: string) => void } | null>(null)

  const pending = useMemo(() => Object.values(pendingTransactions), [pendingTransactions])
  const since = windowChoice === '3m' ? monthsBefore(localToday(), 3) : undefined
  const groups = useMemo(() => sortGroups(buildMerchantGroups(pending, { since }), sort), [pending, since, sort])
  const queueTotal = pending.filter(isQueueRow).length
  const inWindow = groups.reduce((n, g) => n + g.count, 0)
  const needsLook = pending.length - queueTotal
  const setAside = pending.filter((tx) => tx.flag && !tx.duplicate).length
  const hasCategories = Object.keys(categories).length > 0

  /** Files rows and offers one undo that also forgets the rule it learned. */
  const file = (ids: string[], categoryId: string, learn: boolean, what: string) => {
    const before = useTriageStore.getState()
    const rulesBefore = before.categoryRules
    const rows = Object.values(before.pendingTransactions)
    const offer = captureTriageUndo({ pendingIds: rows.map((tx) => tx.id), recordIds: rows.flatMap((tx) => (tx.importRecordId ? [tx.importRecordId] : [])) })
    const added = useTriageStore.getState().categorizeAndAdd(ids, categoryId, { learn })
    if (!added.length) return
    setFiledThisVisit((n) => n + added.length)
    const extra = added.length - ids.filter((id) => added.includes(id)).length
    const label = `Filed ${what} as ${useBudgetStore.getState().categories[categoryId]?.name ?? 'that category'}${extra > 0 ? `, plus ${extra} more from the same store` : ''}`
    offer(label)
    const restore = useUndoStore.getState().pending!.undo
    useUndoStore.getState().offerUndo(label, () => {
      useBudgetStore.getState().deleteTransactions(added)
      restore()
      useTriageStore.setState({ categoryRules: rulesBefore })
      setFiledThisVisit((n) => Math.max(0, n - added.length))
    })
  }

  const ignore = (ids: string[], what: string) => {
    const rows = ids.map((id) => useTriageStore.getState().pendingTransactions[id]).filter((tx): tx is TriageTransaction => !!tx)
    const offer = captureTriageUndo({ pendingIds: ids, recordIds: rows.flatMap((tx) => (tx.importRecordId ? [tx.importRecordId] : [])) })
    for (const id of ids) useTriageStore.getState().rejectTransaction(id)
    offer(`Left ${what} out of your budget`)
  }

  const chooseForGroup = (group: MerchantGroup, value: string) => {
    const what = `${group.count} ${group.label}`
    if (value === IGNORE) ignore(group.ids, what)
    else file(group.ids, value, true, what)
    setOpen(null)
  }

  const chooseForRow = (tx: TriageTransaction, value: string) => {
    if (value === IGNORE) ignore([tx.id], '1 transaction')
    else file([tx.id], value, false, '1 transaction')
  }

  const done = filedThisVisit
  const progress = done + queueTotal > 0 ? done / (done + queueTotal) : 1

  return (
    <div className="flex flex-col gap-5 max-w-[720px] mx-auto w-full">
      <Link to="/budget?tab=transactions" className="-mb-2 inline-flex items-center gap-0.5 self-start min-h-[44px] -ml-2 pr-2 text-[17px] text-accent">
        <ChevronLeft className="w-6 h-6" aria-hidden="true" /> Budgeting
      </Link>
      <PageHeader
        title="Categorize"
        subtitle="Pick a category for each store once. Ledger files every transaction from it now and automatically from then on."
      />

      <section className="themed-card p-4 flex flex-col gap-3" aria-label="Progress">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[34px] font-bold leading-none tracking-tight">{queueTotal.toLocaleString()}</p>
            <p className="text-[15px] text-text-secondary mt-1">left to categorize</p>
          </div>
          {done > 0 && <p className="text-[15px] font-medium text-success">{done.toLocaleString()} filed</p>}
        </div>
        <div className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--text-secondary)_18%,transparent)] overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div role="radiogroup" aria-label="Which transactions" className="grid grid-cols-2 gap-0.5 p-0.5 rounded-[9px] bg-[color-mix(in_srgb,var(--text-secondary)_16%,transparent)]">
          {([['3m', 'Last 3 months'], ['all', 'All']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={windowChoice === value}
              onClick={() => setWindowChoice(value)}
              className={`min-h-[32px] rounded-[7px] text-[13px] font-semibold text-text-primary ${windowChoice === value ? 'bg-card-bg shadow-[0_3px_8px_rgba(0,0,0,0.12)]' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {!hasCategories && (
        <section className="themed-card p-4">
          <p className="text-[15px]">You have no categories yet. Tap <span className="font-semibold">+</span> beside any store to make one as you go, or set them all up in <Link to="/budget?tab=setup" className="font-semibold text-accent">Budgeting → Setup</Link>.</p>
        </section>
      )}

      {needsLook > 0 && (
        <section className="themed-card p-4 flex flex-col gap-3 text-[15px]">
          <p>
            <span className="font-semibold">{needsLook}</span> {needsLook === 1 ? 'is' : 'are'} set aside
            {setAside > 0 ? ` (${setAside} transfer${setAside === 1 ? '' : 's'} or card payment${setAside === 1 ? '' : 's'}` : ' ('}
            {needsLook - setAside > 0 ? `${setAside > 0 ? ', ' : ''}${needsLook - setAside} possible duplicate${needsLook - setAside === 1 ? '' : 's'}` : ''}).
          </p>
          <div className="flex flex-wrap gap-2">
            {setAside > 0 && (
              <button
                type="button"
                onClick={() => {
                  const ids = pending.filter((tx) => tx.flag && !tx.duplicate).map((tx) => tx.id)
                  const offer = captureTriageUndo({ pendingIds: ids })
                  const moved = useTriageStore.getState().includeSetAside()
                  if (moved.length) offer(`Moved ${moved.length} set-aside transaction${moved.length === 1 ? '' : 's'} into Categorize`)
                }}
                className="min-h-[44px] px-4 rounded-[10px] bg-accent text-bg-primary font-semibold"
              >
                Categorize them too
              </button>
            )}
            <Link to="/budget?tab=transactions" className="min-h-[44px] px-4 rounded-[10px] inline-flex items-center bg-[color-mix(in_srgb,var(--text-secondary)_14%,transparent)] text-accent font-semibold">
              Review in Transactions
            </Link>
          </div>
        </section>
      )}

      {queueTotal === 0 ? (
        <section className="themed-card p-8 flex flex-col items-center gap-2 text-center">
          <span className="w-12 h-12 rounded-full bg-success text-white flex items-center justify-center"><Check className="w-7 h-7" aria-hidden="true" /></span>
          <p className="text-[20px] font-semibold">All caught up</p>
          <p className="text-[15px] text-text-secondary">New imports from stores you have categorized are filed for you.</p>
        </section>
      ) : groups.length === 0 ? (
        <section className="themed-card p-6 text-center">
          <p className="text-[17px] font-semibold">Nothing left in the last 3 months</p>
          <p className="text-[15px] text-text-secondary mt-1">{queueTotal} older transaction{queueTotal === 1 ? '' : 's'} still wait.</p>
          <button type="button" onClick={() => setWindowChoice('all')} className="mt-3 min-h-[44px] px-4 rounded-[10px] bg-accent text-bg-primary font-semibold">Show all</button>
        </section>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 px-1 -mb-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-text-secondary">
              {groups.length} store{groups.length === 1 ? '' : 's'} · {inWindow} transaction{inWindow === 1 ? '' : 's'}
            </p>
            <label className="flex items-center gap-1 text-[15px] text-text-secondary shrink-0">
              <span>Sort</span>
              <select
                aria-label="Sort stores"
                value={sort}
                onChange={(e) => setSort(e.target.value as GroupSort)}
                className="min-h-[44px] bg-transparent text-accent font-semibold text-right appearance-none pr-1"
              >
                {GROUP_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <ul className="flex flex-col gap-3" aria-label="Stores to categorize">
            {groups.map((group) => (
              <li key={group.id} className="themed-card p-4 flex flex-col gap-3" data-testid="merchant-group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold truncate">{group.label}</h2>
                    <p className="text-[13px] text-text-secondary">
                      {group.count} transaction{group.count === 1 ? '' : 's'} · latest {shortDate(group.latestDate)}
                    </p>
                  </div>
                  <p className={`text-[17px] font-semibold shrink-0 ${group.type === 'income' ? 'text-success' : ''}`}>{group.type === 'income' ? '+' : ''}{formatMoneyWithCents(group.total)}</p>
                </div>
                <p className="text-[12px] text-text-secondary break-words -mt-1 line-clamp-2">{group.samples.slice(0, 2).join(' · ')}</p>
                <CategorySelect
                  type={group.type}
                  label={`Category for ${group.label}`}
                  categories={categories}
                  groups={categoryGroups}
                  value={group.suggestedCategoryId}
                  onChoose={(value) => chooseForGroup(group, value)}
                  onNew={() => setCreating({ kind: group.type, apply: (id) => chooseForGroup(group, id) })}
                  allowIgnore
                />
                {group.count > 1 && (
                  <button
                    type="button"
                    aria-expanded={open === group.id}
                    onClick={() => setOpen(open === group.id ? null : group.id)}
                    className="self-start inline-flex items-center gap-1.5 min-h-[44px] text-[15px] text-accent"
                  >
                    <ListChecks className="w-4 h-4" aria-hidden="true" /> {open === group.id ? 'Done' : 'Pick one by one'}
                  </button>
                )}
                {open === group.id && (
                  <ul className="flex flex-col divide-y divide-border border-t border-border -mx-4 px-4">
                    {group.ids
                      .map((id) => pendingTransactions[id])
                      .filter((tx): tx is TriageTransaction => !!tx)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((tx) => (
                        <li key={tx.id} className="py-3 flex flex-col gap-2">
                          <div className="flex justify-between gap-3 text-[15px]">
                            <span className="min-w-0 break-words">{tx.description}</span>
                            <span className="shrink-0 font-medium">{formatMoneyWithCents(tx.amount)}</span>
                          </div>
                          <p className="text-[13px] text-text-secondary -mt-1">{shortDate(tx.date)} · not remembered for the store</p>
                          <CategorySelect
                            type={tx.type}
                            label={`Category for ${tx.description} on ${tx.date}`}
                            categories={categories}
                            groups={categoryGroups}
                            value={tx.categoryId}
                            onChoose={(value) => chooseForRow(tx, value)}
                            onNew={() => setCreating({ kind: tx.type, apply: (id) => chooseForRow(tx, id) })}
                            allowIgnore
                          />
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <NewCategorySheet
        open={creating !== null}
        kind={creating?.kind ?? 'expense'}
        onClose={() => setCreating(null)}
        onCreated={(id) => creating?.apply(id)}
      />
    </div>
  )
}

export default Categorize
