import React from 'react'
import { Wallet } from 'lucide-react'
import { WidgetWrapper } from '../WidgetWrapper'
import { useBudgetStore, getMonthlyBudgetStats } from '../../../store/useBudgetStore'
import { formatMoney } from '../../planner/format'
import { EmptyState } from '../../ui/EmptyState'
import { InfoButton } from '../../ui/InfoButton'
import { useIsDesktop } from '../../../hooks/useMediaQuery'
import { BudgetPaceMobile } from './BudgetPaceMobile'

export const BudgetHealthWidget: React.FC = () => {
  const budgetState = useBudgetStore()
  const phone = !useIsDesktop()

  if (Object.keys(budgetState.transactions).length === 0) {
    return (
      <WidgetWrapper
        title="This Month's Budget"
        titleAdornment={<InfoButton label="About This Month's Budget" inline><p>Import a CSV or add one by hand, and your monthly health appears here.</p></InfoButton>}
      >
        <EmptyState
          icon={Wallet}
          message="No Transactions Available"
          action={{ label: 'Add Transactions', to: '/budget' }}
        />
      </WidgetWrapper>
    )
  }

  const now = new Date()
  const stats = getMonthlyBudgetStats(budgetState, now.getFullYear(), now.getMonth())

  return (
    <WidgetWrapper title="This Month's Budget">
      {phone ? <BudgetPaceMobile stats={stats} now={now} /> : (<div className="flex flex-col gap-1 mt-2">
        <span className={`text-[28px] font-bold ${stats.remaining >= 0 ? 'text-accent' : 'text-error'}`}>
          {formatMoney(stats.remaining)}
        </span>
        <span className="text-[12px] text-text-secondary">left of targets · {formatMoney(stats.spent)} spent</span>
        <span className="text-[12px] text-text-secondary">{formatMoney(stats.unallocated)} unallocated</span>
      </div>)}
    </WidgetWrapper>
  )
}
