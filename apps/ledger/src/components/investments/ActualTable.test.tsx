import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ActualTable } from './ActualTable'
import type { InvestmentAnalysis, Position } from '../../store/useAnalysisStore'

function buildPosition(): Position {
  return {
    id: 'pos-1',
    ticker: 'AAPL',
    plannedAmount: 1000,
    startPrice: 100,
    startPriceSource: 'manual',
    acted: true,
    lots: [
      {
        id: 'lot-1',
        date: '2024-01-01',
        amountInvested: 1000,
        price: 100,
      },
    ],
  }
}

function buildAnalysis(position: Position): InvestmentAnalysis {
  return {
    id: 'analysis-1',
    name: 'Test Analysis',
    analysisDate: '2024-01-01',
    positions: [position],
    swaps: [],
  }
}

describe('ActualTable', () => {
  it('renders a mobile card list alongside the desktop table with matching values', () => {
    const position = buildPosition()
    const analysis = buildAnalysis(position)
    const { container } = render(<ActualTable analysis={analysis} priceFor={() => 150} />)

    const cards = container.querySelector('[data-testid="actual-cards"]')
    expect(cards).not.toBeNull()
    expect(cards?.textContent).toContain('AAPL')
    expect(cards?.textContent).toContain('$1,000')

    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    expect(table?.textContent).toContain('AAPL')
  })
})
