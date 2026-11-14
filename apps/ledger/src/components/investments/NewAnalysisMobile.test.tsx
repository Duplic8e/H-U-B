import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NewAnalysisMobile } from './NewAnalysisMobile'
import { useAnalysisStore } from '../../store/useAnalysisStore'

vi.mock('../../services/marketData', () => ({
  useHistoricalPrice: (ticker: string) =>
    ticker.trim() === 'RY'
      ? { data: { value: { close: 160 }, source: 'live', stale: false }, status: 'success', refresh: () => {} }
      : { data: undefined, status: 'idle', refresh: () => {} },
}))

const initial = useAnalysisStore.getState()

describe('NewAnalysisMobile', () => {
  beforeEach(() => useAnalysisStore.setState({ analyses: [] }))
  afterEach(() => useAnalysisStore.setState(initial, true))

  it('labels the name field New Analysis Name and has no title of its own', () => {
    render(<NewAnalysisMobile onClose={() => {}} />)
    expect(screen.getByText('New Analysis Name (Defaults to Ticker)')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows amount, the looked-up start price and shares for a ticker', () => {
    render(<NewAnalysisMobile onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ticker 1'), { target: { value: 'RY' } })
    fireEvent.change(screen.getByLabelText('Allocation % 1'), { target: { value: '50' } })
    const row = screen.getByLabelText('Ticker 1').closest('div')!.parentElement!
    expect(row).toHaveTextContent('$5,000')
    expect(row).toHaveTextContent('160.00')
    expect(row).toHaveTextContent('31.25')
    expect(row).toHaveTextContent('Auto')
  })

  it('lets you type a start price when the lookup finds none', () => {
    render(<NewAnalysisMobile onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ticker 1'), { target: { value: 'XYZ' } })
    fireEvent.click(screen.getByRole('button', { name: /Start price 1, tap to edit/ }))
    fireEvent.change(screen.getByLabelText('Start price 1'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Allocation % 1'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Analysis' }))
    expect(useAnalysisStore.getState().analyses[0].positions[0]).toMatchObject({ ticker: 'XYZ', startPrice: 25, startPriceSource: 'manual', plannedAmount: 10000 })
  })

  it('splits evenly, reports what is left and saves the analysis', () => {
    const onClose = vi.fn()
    render(<NewAnalysisMobile onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Ticker 1'), { target: { value: 'RY' } })
    fireEvent.click(screen.getByRole('button', { name: /Add Ticker/ }))
    fireEvent.change(screen.getByLabelText('Ticker 2'), { target: { value: 'TD' } })
    expect(screen.getByText('100% Left')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Split Evenly' }))
    expect(screen.getByText('Fully Allocated')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save Analysis' }))
    const a = useAnalysisStore.getState().analyses[0]
    expect(a.name).toBe('RY')
    expect(a.positions.map((p) => p.ticker)).toEqual(['RY', 'TD'])
    expect(onClose).toHaveBeenCalled()
  })

  it('disables Save until a ticker has an allocation', () => {
    render(<NewAnalysisMobile onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Save Analysis' })).toBeDisabled()
  })
})
