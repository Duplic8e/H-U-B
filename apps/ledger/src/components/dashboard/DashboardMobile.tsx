import React, { useId, useState } from 'react'
import { ChevronRight, Edit2, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useAccountsStore } from '../../store/useAccountsStore'
import type { Account, AccountCurrency, AccountType } from '../../store/useAccountsStore'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useUndoStore } from '../../store/useUndoStore'
import { useAccountValuation } from '../../hooks/useAccountValuation'
import { PHONE_LIST_LIMIT, useShowMore } from '../../hooks/useShowMore'
import { netWorthTrend } from '../../utils/accounts/accountValuation'
import { countsAsIncome } from '../../utils/budget/sharedExpenses'
import { detectRecurring } from '../../utils/budget/recurring'
import { forecastMonthEnd } from '../../utils/budget/cashFlowForecast'
import { unpaidBillsThisMonth } from '../../utils/budget/cashPlan'
import { useRecurringStore } from '../../store/useRecurringStore'
import { inRange } from '../../utils/budget/period'
import { formatMoney } from '../planner/format'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { ShowMoreButton } from '../ui/ShowMoreButton'

const AddAccountModal = React.lazy(() => import('./AddAccountModal').then((m) => ({ default: m.AddAccountModal })))

/** Which Customize ids switch each account group on or off. */
const GROUPS: { type: AccountType; widgetId: string; title: string; short: string; noun: string; add: string }[] = [
  { type: 'bank', widgetId: 'bank', title: 'Bank Accounts', short: 'Bank', noun: 'bank accounts', add: 'Add Bank Account' },
  { type: 'investment', widgetId: 'investment-accounts', title: 'Investment Accounts', short: 'Invest', noun: 'investment accounts', add: 'Add Investment Account' },
  { type: 'other', widgetId: 'other', title: 'Others', short: 'Others', noun: 'other assets', add: 'Add Other Asset' },
  { type: 'receivable', widgetId: 'receivable', title: 'Receivables', short: 'Owed', noun: 'receivables', add: 'Add Receivable' },
  { type: 'debt', widgetId: 'debt', title: 'Debts & Liabilities', short: 'Debts', noun: 'debts', add: 'Add Debt' },
]

const MONTH_WIDGETS = ['income', 'expense', 'monthly-summary']

const fmt = (amount: number, currency: AccountCurrency) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency, currencyDisplay: currency === 'USD' ? 'code' : 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amount)


const NetWorthCard: React.FC = () => {
  const history = useAccountsStore((s) => s.history)
  const { netWorth } = useAccountValuation()
  const trend = netWorthTrend(netWorth, history)

  // Mirrors netWorthTrend's own notion of a real comparison: the newest snapshot at or before the end
  // of last month must exist and be non-zero. A zero there reports growth that never happened.
  const now = new Date()
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const cutoff = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastMonthEnd.getDate()).padStart(2, '0')}`
  const past = history.filter((h) => h.date <= cutoff).sort((a, b) => b.date.localeCompare(a.date))[0]
  const hasComparison = trend !== null && past !== undefined && past.value !== 0
  const up = trend !== null && trend >= 0

  return (
    <section data-widget-id="trend" className="themed-card rounded-2xl p-4" aria-label="Net Worth">
      <h2 className="text-[15px] font-semibold text-text-secondary">Net Worth</h2>
      <div data-key-figure className="[overflow-wrap:anywhere] text-[36px] font-bold leading-[1.1] text-text-primary mt-1">
        {netWorth === null ? 'Conversion Needed' : (
          <AnimatedNumber
            value={netWorth}
            format={(n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
        )}
      </div>
      {netWorth !== null && (
        <div className="mt-2">
          {hasComparison && trend !== null ? (
            <span className={`inline-flex items-center gap-1 text-[14px] font-medium ${up ? 'text-accent' : 'text-error'}`}>
              {up ? <TrendingUp size={16} aria-hidden="true" /> : <TrendingDown size={16} aria-hidden="true" />}
              {up ? '+' : ''}{trend.toFixed(2)}%
              <span className="font-normal text-text-secondary">vs Last Month</span>
            </span>
          ) : (
            <span className="text-[13px] text-text-secondary">No comparison for last month yet</span>
          )}
        </div>
      )}
    </section>
  )
}

const MonthCard: React.FC<{ projected: boolean; range: { from: string; to: string } }> = ({ projected, range }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const list = Object.values(transactions).filter((t) => inRange(t.date, range))
  const income = list.filter((t) => countsAsIncome(t)).reduce((s, t) => s + t.amount, 0)
  const expense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expense
  const today = new Date().toISOString().slice(0, 10)
  const plannedBills = useRecurringStore((s) => s.plannedBills)
  const detected = projected ? detectRecurring(transactions) : []
  const forecast = projected
    ? forecastMonthEnd(transactions, detected, range.to, today, unpaidBillsThisMonth(plannedBills, transactions, range.to, detected.map((d) => d.description)))
    : null

  const used = income > 0 ? Math.min(1, expense / income) : expense > 0 ? 1 : 0
  const tone = (n: number) => (n >= 0 ? 'text-text-primary' : 'text-error')
  const signed = (n: number) => `${n >= 0 ? '+' : '-'}${formatMoney(Math.abs(n))}`

  return (
    <section className="themed-card rounded-2xl p-4" aria-label="This Month">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-semibold text-text-primary">This Month</h2>
        <span data-key-figure className={`text-[18px] font-bold tabular-nums ${tone(net)}`}>{signed(net)}</span>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-bg-tertiary" role="img" aria-label={`${Math.round(used * 100)} percent of money in has gone out`}>
        <div className={expense > income ? 'bg-error' : 'bg-accent'} style={{ width: `${used * 100}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[14px]">
        <span><span className="text-text-secondary">In </span><span className="font-semibold tabular-nums text-accent">{formatMoney(income)}</span></span>
        <span><span className="text-text-secondary">Out </span><span className="font-semibold tabular-nums text-error">{formatMoney(expense)}</span></span>
      </div>
      {forecast && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[14px]">
          <span className="text-text-secondary">Projected Net</span>
          <span className={`font-medium tabular-nums ${tone(forecast.projectedNet)}`}>{signed(forecast.projectedNet)}</span>
        </div>
      )}
    </section>
  )
}

const AccountRow: React.FC<{ account: Account; cad: number | null | undefined; onEdit: () => void; onRemove: () => void }> = ({ account: a, cad, onEdit, onRemove }) => (
  <div data-testid={`account-row-${a.id}`} className="flex items-center justify-between gap-2 min-h-11">
    <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 py-2.5">
      <span data-testid={`account-name-${a.id}`} className="min-w-0 break-words text-[15px] text-text-primary">
        {a.name}
        {a.currency === 'USD' && <span className="ml-2 rounded border border-border bg-bg-tertiary px-1.5 py-0.5 text-micro font-medium text-text-secondary align-middle">USD</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[15px] font-medium tabular-nums text-text-primary" aria-label={a.currency === 'USD' ? fmt(a.value, 'USD') : undefined}>{fmt(a.value, 'CAD')}</span>
        {a.currency === 'USD' && (
          <span className="block text-[13px] tabular-nums text-text-secondary">{cad === null ? 'Conversion Needed' : `≈ ${fmt(cad ?? 0, 'CAD')}`}</span>
        )}
      </span>
    </div>
    <div className="flex shrink-0">
      <button type="button" onClick={onEdit} aria-label="Edit account" className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary"><Edit2 size={16} aria-hidden="true" /></button>
      <button type="button" onClick={onRemove} aria-label={`Delete ${a.name}`} className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary"><Trash2 size={16} aria-hidden="true" /></button>
    </div>
  </div>
)

const GroupFold: React.FC<{ group: (typeof GROUPS)[number]; color: string; onAdd: () => void; onEdit: (a: Account) => void }> = ({ group, color, onAdd, onEdit }) => {
  const accounts = useAccountsStore((s) => s.accounts)
  const removeAccount = useAccountsStore((s) => s.removeAccount)
  const addAccount = useAccountsStore((s) => s.addAccount)
  const offerUndo = useUndoStore((s) => s.offerUndo)
  const valuation = useAccountValuation()
  const listId = useId()
  const rows = accounts.filter((a) => a.type === group.type)
  const list = useShowMore(rows, PHONE_LIST_LIMIT)
  const total = valuation.totals[group.type]

  return (
    <details data-widget-id={group.widgetId} className="themed-card rounded-2xl group">
      <summary className="flex items-center gap-3 px-4 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
        <span className="flex-1 min-w-0 text-[15px] font-semibold text-text-primary">
          {group.title}<span className="ml-2 text-[13px] font-normal text-text-secondary">{rows.length}</span>
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-text-primary">{total === null ? 'Conversion Needed' : fmt(total, 'CAD')}</span>
        <ChevronRight className="w-4 h-4 shrink-0 text-text-secondary transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="px-4 pb-1 border-t border-border pt-1">
        <div id={listId}>
          {rows.length === 0
            ? <p className="py-2 text-[14px] text-text-secondary">No {group.noun} yet.</p>
            : (
              <div className="divide-y divide-border">
                {list.visible.map((a) => (
                  <AccountRow
                    key={a.id}
                    account={a}
                    cad={valuation.cadById[a.id]}
                    onEdit={() => onEdit(a)}
                    onRemove={() => {
                      removeAccount(a.id)
                      // The restored account gets a fresh id because addAccount mints one; nothing else
                      // references an account id today.
                      offerUndo(`Deleted account "${a.name}"`, () => addAccount({ name: a.name, value: a.value, type: a.type, currency: a.currency }))
                    }}
                  />
                ))}
              </div>
            )}
        </div>
        {list.truncates && <ShowMoreButton total={rows.length} noun="accounts" expanded={list.expanded} onToggle={list.toggle} controls={listId} />}
        <button type="button" onClick={onAdd} aria-label={group.add} className="inline-flex items-center gap-1 min-h-11 px-2 -ml-2 text-[14px] font-medium text-text-secondary">
          <Plus size={16} aria-hidden="true" />Add
        </button>
      </div>
    </details>
  )
}

const FOLD_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--color-error)']

const AccountFolds: React.FC<{ groups: typeof GROUPS }> = ({ groups }) => {
  const accounts = useAccountsStore((s) => s.accounts)
  const [modal, setModal] = useState<{ type: AccountType; editing: Account | null } | null>(null)
  const [modalOpenedBefore, setModalOpenedBefore] = useState(false)
  const open = (type: AccountType, editing: Account | null) => { setModalOpenedBefore(true); setModal({ type, editing }) }
  const first = groups.find((g) => accounts.some((a) => a.type === g.type)) ?? groups[0]

  return (
    <>
      <h2 className="px-1 -mb-1 text-[18px] font-semibold text-text-primary">Accounts</h2>
      {groups.map((g) => (
        <GroupFold
          key={g.type}
          group={g}
          color={FOLD_COLORS[GROUPS.findIndex((x) => x.type === g.type)]}
          onAdd={() => open(g.type, null)}
          onEdit={(a) => open(a.type, a)}
        />
      ))}
      {modalOpenedBefore && (
        <React.Suspense fallback={null}>
          <AddAccountModal isOpen={modal !== null} onClose={() => setModal(null)} defaultType={modal?.type ?? first.type} editingAccount={modal?.editing ?? null} />
        </React.Suspense>
      )}
    </>
  )
}

interface DashboardMobileProps {
  /** Customize ids the user switched off. */
  hidden: string[]
  /** Every other visible widget, in saved order. */
  rest: React.ReactNode
}

/** Phone Dashboard: the net worth figure, one This Month band, then one fold per account group with its
 *  total on the right, followed by the remaining widgets. The Customize switches for the widgets these
 *  replace still apply: Net Worth hides the figure, the three month widgets hide the band together, and
 *  each account group hides its fold. */
export const DashboardMobile: React.FC<DashboardMobileProps> = ({ hidden, rest }) => {
  const month = new Date().toISOString().substring(0, 7)
  const groups = GROUPS.filter((g) => !hidden.includes(g.widgetId))
  const showMonth = MONTH_WIDGETS.some((id) => !hidden.includes(id))
  return (
    <div className="flex flex-col gap-4">
      {!hidden.includes('trend') && <NetWorthCard />}
      {showMonth && <MonthCard projected={!hidden.includes('monthly-summary')} range={{ from: month, to: month }} />}
      {groups.length > 0 && <AccountFolds groups={groups} />}
      {rest}
    </div>
  )
}
