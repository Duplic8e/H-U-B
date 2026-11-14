import React, { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useCompensationStore } from '../../store/useCompensationStore'
import { useRecurringStore } from '../../store/useRecurringStore'
import { useTakeHomeEstimate } from '../../hooks/useTakeHomeEstimate'
import { monthlyEquivalent } from '../../utils/budget/cadence'
import { PLAN_PERIODS, annualBillAmount, buildCashPlan, inPeriod, type PlanPeriod, type PlannedBill } from '../../utils/budget/cashPlan'
import { formatMoney } from '../planner/format'

const FIELD = 'w-full min-h-[44px] px-3 rounded-[10px] bg-[color-mix(in_srgb,var(--text-secondary)_14%,transparent)] text-[16px] text-text-primary'
const LABEL = 'text-[13px] font-medium uppercase tracking-wide text-text-secondary'

const PERIOD_NOUN: Record<PlanPeriod, string> = { weekly: 'week', biweekly: '2 weeks', monthly: 'month', yearly: 'year' }

const BillForm: React.FC<{ bill: PlannedBill | null; onClose: () => void }> = ({ bill, onClose }) => {
  const categories = useBudgetStore((s) => s.categories)
  const groups = useBudgetStore((s) => s.categoryGroups)
  const [name, setName] = useState(bill?.name ?? '')
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '')
  const [cadence, setCadence] = useState<PlanPeriod>(bill?.cadence ?? 'monthly')
  const [dueDay, setDueDay] = useState(bill?.dueDay ? String(bill.dueDay) : '1')
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? '')
  const ids = { name: useId(), amount: useId(), cadence: useId(), day: useId(), category: useId() }
  const value = Number(amount)
  const ready = name.trim() !== '' && Number.isFinite(value) && value > 0
  const expense = Object.values(categories).filter((c) => groups[c.groupId]?.kind === 'expense').sort((a, b) => a.name.localeCompare(b.name))

  const save = () => {
    if (!ready) return
    const day = Math.min(31, Math.max(1, Math.round(Number(dueDay)) || 1))
    useRecurringStore.getState().saveBill({
      id: bill?.id ?? crypto.randomUUID(), name: name.trim(), amount: Math.round(value * 100) / 100, cadence,
      dueDay: cadence === 'monthly' ? day : undefined, categoryId: categoryId || undefined,
    })
    onClose()
  }

  return (
    <form className="flex flex-col gap-4 p-4" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className={LABEL}>Name</label>
        <input id={ids.name} autoFocus={!bill} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent, Phone" className={FIELD} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.amount} className={LABEL}>Amount</label>
          <input id={ids.amount} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className={FIELD} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.cadence} className={LABEL}>Every</label>
          <select id={ids.cadence} value={cadence} onChange={(e) => setCadence(e.target.value as PlanPeriod)} className={`${FIELD} appearance-none`}>
            <option value="weekly">Week</option>
            <option value="biweekly">2 weeks</option>
            <option value="monthly">Month</option>
            <option value="yearly">Year</option>
          </select>
        </div>
      </div>
      {cadence === 'monthly' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.day} className={LABEL}>Due on day of month</label>
          <input id={ids.day} inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} className={FIELD} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.category} className={LABEL}>Budget category (optional)</label>
        <select id={ids.category} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${FIELD} appearance-none`}>
          <option value="">None</option>
          {expense.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="text-[13px] text-text-secondary">Pick one so the bill is not counted a second time against that category's target.</p>
      </div>
      <button type="submit" disabled={!ready} className="min-h-[50px] rounded-xl bg-accent text-bg-primary text-[17px] font-semibold disabled:opacity-50">{bill ? 'Save' : 'Add Bill'}</button>
      {bill && (
        <button type="button" onClick={() => { useRecurringStore.getState().removeBill(bill.id); onClose() }} className="min-h-[44px] text-[17px] text-error">Delete Bill</button>
      )}
    </form>
  )
}

/** Salary flows into the budget: pay, less tax and ESPP, is what reaches the
 *  bank; recurring bills and the rest of the budget come out of it. One
 *  period switch restates every line per week, two weeks, month or year. */
export const CashPlanWidget: React.FC = () => {
  const pkg = useCompensationStore((s) => s.primaryPackage)
  const bills = useRecurringStore((s) => s.plannedBills)
  const period = useRecurringStore((s) => s.planPeriod)
  const setPeriod = useRecurringStore((s) => s.setPlanPeriod)
  const categories = useBudgetStore((s) => s.categories)
  const groups = useBudgetStore((s) => s.categoryGroups)
  const { takeHome, province } = useTakeHomeEstimate(pkg.baseSalary || 0)
  const [editing, setEditing] = useState<PlannedBill | 'new' | null>(null)

  const plan = useMemo(() => {
    const monthlyTargets: Record<string, number> = {}
    for (const c of Object.values(categories)) {
      if (groups[c.groupId]?.kind === 'expense') monthlyTargets[c.id] = monthlyEquivalent(c)
    }
    return buildCashPlan({ grossSalary: pkg.baseSalary || 0, netSalary: takeHome.net, esppPercent: pkg.esppContributionPercent || 0, bills, monthlyTargets })
  }, [pkg.baseSalary, pkg.esppContributionPercent, takeHome.net, bills, categories, groups])

  const show = (annual: number) => formatMoney(inPeriod(annual, period))
  const hasSalary = plan.gross > 0
  const row = (label: string, value: string, opts: { sub?: string; strong?: boolean; tone?: 'in' | 'out' | 'left' } = {}) => (
    <div className={`flex items-baseline justify-between gap-3 py-2 ${opts.strong ? 'border-t border-border mt-1 pt-3' : ''}`}>
      <span className="min-w-0">
        <span className={`block ${opts.strong ? 'text-[17px] font-semibold' : 'text-[15px]'}`}>{label}</span>
        {opts.sub && <span className="block text-[13px] text-text-secondary">{opts.sub}</span>}
      </span>
      <span className={`shrink-0 ${opts.strong ? 'text-[17px] font-semibold' : 'text-[15px]'} ${opts.tone === 'left' ? (plan.leftover >= 0 ? 'text-success' : 'text-error') : ''}`}>{value}</span>
    </div>
  )

  return (
    <section className="themed-card p-4 flex flex-col gap-2" aria-label="Cash Plan" data-testid="cash-plan">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Cash Plan</h2>
        <select aria-label="Show amounts per" value={period} onChange={(e) => setPeriod(e.target.value as PlanPeriod)} className="min-h-[44px] bg-transparent text-accent font-semibold text-right appearance-none">
          {PLAN_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {hasSalary ? (
        <div>
          {row('Salary', show(plan.gross), { sub: 'From Compensation' })}
          {row('Tax, CPP and EI', `−${show(plan.taxes)}`, { sub: `Estimated for ${province}` })}
          {plan.espp > 0 && row('ESPP', `−${show(plan.espp)}`, { sub: `${pkg.esppContributionPercent}% of pay` })}
          {row('Take-home', show(plan.takeHome), { strong: true })}
        </div>
      ) : (
        <Link to="/compensation" className="flex items-center justify-between gap-3 py-2 text-[15px]">
          <span>Add your salary in Compensation to see your take-home pay here.</span>
          <ChevronRight className="w-5 h-5 text-text-secondary shrink-0" aria-hidden="true" />
        </Link>
      )}

      <div className="border-t border-border pt-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Recurring bills</h3>
          <span className="text-[15px]">{bills.length ? `−${show(plan.bills)}` : ''}</span>
        </div>
        {bills.length === 0 && <p className="text-[13px] text-text-secondary py-1">Rent, phone, insurance: anything you pay on a schedule.</p>}
        <ul>
          {bills.map((bill) => (
            <li key={bill.id}>
              <button type="button" onClick={() => setEditing(bill)} aria-label={`Edit ${bill.name}`} className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left">
                <span className="min-w-0">
                  <span className="block text-[15px] truncate">{bill.name}</span>
                  <span className="block text-[13px] text-text-secondary">
                    {formatMoney(bill.amount)} every {PERIOD_NOUN[bill.cadence]}{bill.cadence === 'monthly' && bill.dueDay ? ` · due day ${bill.dueDay}` : ''}
                  </span>
                </span>
                <span className="shrink-0 flex items-center gap-1 text-[15px] text-text-secondary">{show(annualBillAmount(bill))}<ChevronRight className="w-4 h-4" aria-hidden="true" /></span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setEditing('new')} className="min-h-[44px] inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent">
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Bill
        </button>
      </div>

      <div>
        {plan.otherBudget > 0 && row('Rest of budget', `−${show(plan.otherBudget)}`, { sub: 'Category targets beyond your bills' })}
        {hasSalary && row(plan.leftover >= 0 ? 'Left over' : 'Short by', show(Math.abs(plan.leftover)), { strong: true, tone: 'left', sub: `Per ${PERIOD_NOUN[period]}, after bills and budget` })}
      </div>
      {hasSalary && <p className="text-[12px] text-text-secondary">Base salary only. Bonus and stock are left out because they do not arrive every pay.</p>}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} desktop="modal" ariaLabel={editing === 'new' ? 'Add bill' : 'Edit bill'} title={editing === 'new' ? 'Add Bill' : 'Edit Bill'} panelClassName="w-full max-w-md">
        <BillForm key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id} bill={editing && editing !== 'new' ? editing : null} onClose={() => setEditing(null)} />
      </Sheet>
    </section>
  )
}
