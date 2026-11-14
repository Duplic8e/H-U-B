import React, { useState } from 'react'
import { HandCoins } from 'lucide-react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { iouBalances } from '../../utils/budget/sharedExpenses'
import { formatMoney } from '../planner/format'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/** All-time per-person balances from shared bills. Hidden when empty. */
export const OwedToMeWidget: React.FC = () => {
  const transactions = useBudgetStore((s) => s.transactions)
  const addTransaction = useBudgetStore((s) => s.addTransaction)
  const [settling, setSettling] = useState<{ person: string; amount: number } | null>(null)

  const balances = Object.entries(iouBalances(transactions))
    .filter(([, v]) => Math.abs(v) >= 0.005)
    .sort((a, b) => b[1] - a[1])

  if (balances.length === 0) return null

  return (
    <WidgetWrapper title="Owed to Me">
      <div className="flex flex-col gap-2 mt-2">
        {balances.map(([person, balance]) => (
          <div key={person} className="flex justify-between items-center text-[13px]">
            <span className="text-text-primary flex items-center gap-2">
              <HandCoins size={14} className="text-accent" /> {person}
            </span>
            <span className="flex items-center gap-2">
              <span className={`font-medium ${balance >= 0 ? 'text-text-primary' : 'text-error'}`}>
                {balance >= 0 ? formatMoney(balance) : `${formatMoney(-balance)} overpaid`}
              </span>
              {balance > 0 && (
                <button
                  onClick={() => setSettling({ person, amount: balance })}
                  className="px-2 py-1 rounded-md text-[12px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
                >
                  Settle up
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={settling !== null}
        title="Settle up?"
        message={settling ? `Record a ${formatMoney(settling.amount)} reimbursement from ${settling.person}, clearing their balance.` : ''}
        confirmLabel="Record reimbursement"
        onConfirm={() => {
          if (settling) {
            addTransaction({
              id: crypto.randomUUID(),
              date: new Date().toISOString().split('T')[0],
              amount: Math.round(settling.amount * 100) / 100,
              description: `Settle up from ${settling.person}`,
              type: 'income',
              reimbursement: { from: settling.person },
            })
          }
          setSettling(null)
        }}
        onCancel={() => setSettling(null)}
      />
    </WidgetWrapper>
  )
}
