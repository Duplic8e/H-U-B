import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AllocationBars } from './AllocationBars'
import type { Holding } from '../../store/usePortfolioStore'

const h = (over: Partial<Holding>): Holding => ({
  id: 'h1', ticker: 'AAA', quantity: 1, avgCost: 100, currency: 'CAD', account: 'RRSP', ...over,
})

const rows = [
  { holding: h({ id: '1', ticker: 'ENB', account: 'RRSP' }), price: 100 },
  { holding: h({ id: '2', ticker: 'AAPL', currency: 'USD' as const, account: 'TFSA' }), price: 100 },
]

describe('AllocationBars', () => {
  it('shows all three cuts at once, with no toggle', () => {
    render(<AllocationBars rows={rows} rates={{ USD: 1.37 }} />)
    expect(screen.getByText('Holding')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Currency')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^By / })).not.toBeInTheDocument()
  })

  it('names every segment in text, not only in colour', () => {
    render(<AllocationBars rows={rows} rates={{ USD: 1.37 }} />)
    for (const name of ['ENB', 'AAPL', 'RRSP', 'TFSA', 'CAD', 'USD']) {
      expect(screen.getByText(new RegExp(`${name} \\d`))).toBeInTheDocument()
    }
  })

  it('gives each bar an accessible name carrying its breakdown', () => {
    render(<AllocationBars rows={rows} rates={{ USD: 1.37 }} />)
    expect(screen.getByRole('img', { name: /Allocation by holding/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Allocation by account/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Allocation by currency/ })).toBeInTheDocument()
  })

  it('renders nothing with no rows', () => {
    const { container } = render(<AllocationBars rows={[]} rates={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when every cut has only one slice', () => {
    // One holding, one account, one currency: all three cuts collapse to a
    // single 100% slice, which is dropped as uninformative. With nothing
    // left to show, the whole card should be omitted rather than rendered
    // with a heading and no bars under it.
    const single = [{ holding: h({ id: '1', ticker: 'ENB' }), price: 100 }]
    const { container } = render(<AllocationBars rows={single} rates={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('folds a long holdings list into Other', () => {
    const twelveHoldings = Array.from({ length: 12 }, (_, i) => ({
      holding: h({ id: `h${i}`, ticker: `T${i}`, account: i % 2 === 0 ? 'RRSP' : 'TFSA' }),
      price: 12 - i,
    }))
    render(<AllocationBars rows={twelveHoldings} rates={{}} />)
    expect(screen.getByText(/Other/)).toBeInTheDocument()
    expect(screen.getAllByText(/%/).length).toBeLessThan(12)
  })
})
