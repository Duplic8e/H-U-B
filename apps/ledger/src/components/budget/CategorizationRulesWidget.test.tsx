import { render, screen } from '@testing-library/react'
import { CategorizationRulesWidget } from './CategorizationRulesWidget'
import { useTriageStore } from '../../store/useTriageStore'
import { useBudgetStore } from '../../store/useBudgetStore'

const triageInitial = useTriageStore.getState()
const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  useTriageStore.setState(triageInitial, true)
  useBudgetStore.setState(budgetInitial, true)
})

describe('CategorizationRulesWidget', () => {
  it('counts rules in its title', () => {
    render(<CategorizationRulesWidget />)
    expect(screen.getByText('Categorization Rules (0)')).toBeInTheDocument()
  })

  it('lists an existing rule and the category it maps to', () => {
    useBudgetStore.setState({
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Streaming', targetAmount: 0 } },
    })
    useTriageStore.getState().learnRule('NETFLIX', 'c1')
    render(<CategorizationRulesWidget />)
    expect(screen.getByText('Categorization Rules (1)')).toBeInTheDocument()
    // Rules are stored by merchant and shown in title case.
    expect(screen.getByText('Netflix')).toBeInTheDocument()
  })
})
