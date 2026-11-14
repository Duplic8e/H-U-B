import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BudgetHealthWidget } from './BudgetHealthWidget'
import { PlannerGoalWidget } from './PlannerGoalWidget'
import { NetWorthTrendWidget } from './NetWorthTrendWidget'
import { useBudgetStore } from '../../../store/useBudgetStore'
import { usePlannerStore } from '../../../store/usePlannerStore'
import { useAccountsStore } from '../../../store/useAccountsStore'

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  useBudgetStore.setState({ transactions: {} })
  usePlannerStore.setState({ inputs: {} })
  useAccountsStore.setState({ history: [] })
})

describe('dashboard empty states', () => {
  it('offers a real call to action when there are no transactions', () => {
    wrap(<BudgetHealthWidget />)
    expect(screen.getByText('No Transactions Available')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add Transactions' })).toHaveAttribute('href', '/budget')
  })

  it('offers a real call to action when there is no goal', () => {
    wrap(<PlannerGoalWidget />)
    expect(screen.getByText('No Goal Set')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a Goal' })).toHaveAttribute('href', '/planner/forecaster')
  })

  it('offers a real call to action when there is no history', () => {
    wrap(<NetWorthTrendWidget />)
    expect(screen.getByText('Not Enough History Yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add History' })).toBeInTheDocument()
  })
})
