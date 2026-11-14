import { render, screen } from '@testing-library/react'
import { OwedToMeWidget } from './OwedToMeWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  useBudgetStore.setState(budgetInitial, true)
})

describe('OwedToMeWidget', () => {
  it('stays hidden when nobody owes anything', () => {
    const { container } = render(<OwedToMeWidget />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names a person who owes money from a shared bill', () => {
    useBudgetStore.setState({
      transactions: {
        s1: {
          id: 's1',
          date: '2026-08-01',
          amount: 50,
          description: 'Dinner',
          type: 'expense',
          shared: { totalAmount: 100, sharedWith: 'Sam' },
        },
      },
    })
    render(<OwedToMeWidget />)
    expect(screen.getByText('Sam')).toBeInTheDocument()
  })
})
