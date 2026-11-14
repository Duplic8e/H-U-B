import React from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useRecurringStore } from '../../store/useRecurringStore'
import { unpaidBillsThisMonth } from '../../utils/budget/cashPlan'
import { formatMoney } from '../planner/format'

/** This month's recurring bills, unpaid first, each marked once a matching
 *  transaction has been imported. Bills are added and edited in Plan. */
export const BillsThisMonthCard: React.FC<{ month: string }> = ({ month }) => {
  const bills = useRecurringStore((s) => s.plannedBills)
  const transactions = useBudgetStore((s) => s.transactions)
  const monthly = bills.filter((b) => b.cadence === 'monthly')
  const unpaid = new Set(unpaidBillsThisMonth(monthly, transactions, month).map((b) => b.description))
  const today = new Date().getDate()
  const isThisMonth = month === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const sorted = [...monthly].sort((a, b) => Number(unpaid.has(b.name)) - Number(unpaid.has(a.name)) || (a.dueDay ?? 31) - (b.dueDay ?? 31))
  const left = monthly.filter((b) => unpaid.has(b.name)).reduce((sum, b) => sum + b.amount, 0)

  return (
    <section className="themed-card p-4 flex flex-col gap-1" aria-label="Bills" data-testid="bills-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Bills</h2>
        {monthly.length > 0 && <span className="text-[15px] text-text-secondary">{left > 0 ? `${formatMoney(left)} still to pay` : 'All paid'}</span>}
      </div>
      {monthly.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Add rent, phone and other regular bills to see what is paid and what is still due.</p>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((bill) => {
            const paid = !unpaid.has(bill.name)
            const overdue = !paid && isThisMonth && (bill.dueDay ?? 31) < today
            return (
              <li key={bill.id} className="flex items-center gap-3 min-h-[52px] py-1.5">
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${paid ? 'bg-success text-bg-primary' : 'border-2 border-border-strong'}`} aria-hidden="true">
                  {paid && <Check className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] truncate">{bill.name}</span>
                  <span className={`block text-[13px] ${overdue ? 'text-error' : 'text-text-secondary'}`}>
                    {paid ? 'Paid' : overdue ? `Was due on day ${bill.dueDay}` : `Due on day ${bill.dueDay ?? 'end of month'}`}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-medium">{formatMoney(bill.amount)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <Link to="/budget?tab=setup" className="min-h-[44px] inline-flex items-center gap-1 self-start text-[15px] font-semibold text-accent">
        {monthly.length === 0 ? 'Add bills in Plan' : 'Edit bills in Plan'} <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
