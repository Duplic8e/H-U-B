import { fireEvent, render, screen } from '@testing-library/react'
import { HoldingCardList } from './HoldingCardList'
import type { Holding } from '../../store/usePortfolioStore'

vi.mock('../../services/marketData', () => ({
  useCurrentPrice: () => ({ data: undefined, status: 'idle', refresh: () => {}, setManual: () => {}, clearManual: () => {} }),
}))

const holdings = (n: number): Holding[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `h${i}`, ticker: `T${i}`, quantity: 1, avgCost: 100 - i, currency: 'CAD' as const, account: 'TFSA',
  }))

describe('HoldingCardList', () => {
  it('shows eight holdings per account and the rest behind Show all', () => {
    render(<HoldingCardList account="TFSA" holdings={holdings(17)} rates={{ CAD: 1 }} totalValueCad={1000} onPrice={() => {}} />)
    const list = screen.getByTestId('portfolio-cards-TFSA')
    expect(list.querySelectorAll('[aria-label^="Details for"]')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 17 holdings' }))
    expect(list.querySelectorAll('[aria-label^="Details for"]')).toHaveLength(17)
  })

  it('shows nine holdings whole rather than hiding one', () => {
    render(<HoldingCardList account="TFSA" holdings={holdings(9)} rates={{ CAD: 1 }} totalValueCad={1000} onPrice={() => {}} />)
    expect(screen.getByTestId('portfolio-cards-TFSA').querySelectorAll('[aria-label^="Details for"]')).toHaveLength(9)
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull()
  })
})
