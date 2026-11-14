import { fireEvent, render, screen } from '@testing-library/react'
import { CurrencyConverterMobile } from './CurrencyConverterMobile'
import type { CurrencyConverterState } from './useCurrencyConverter'

const make = (over: Partial<CurrencyConverterState> = {}): CurrencyConverterState => ({
  inputs: { amount: 100, from: 'USD', to: 'CAD', date: '' },
  from: 'USD',
  to: 'CAD',
  rate: 1.4161,
  converted: 141.61,
  fx: { data: { value: { rate: 1.4161 }, source: 'frankfurter', stale: false, asOf: new Date(2026, 9, 16, 18, 42, 41).toISOString() }, status: 'ready', refresh: vi.fn() },
  override: undefined,
  historicalSupported: true,
  set: vi.fn(),
  swap: vi.fn(),
  setOverride: vi.fn(),
  clearOverride: vi.fn(),
  ...over,
} as unknown as CurrencyConverterState)

it('leads with the answer in sentence case and a rate line', () => {
  render(<CurrencyConverterMobile c={make()} />)
  expect(screen.getByText('100 USD is')).toBeInTheDocument()
  expect(screen.getByText('CAD 141.61')).toBeInTheDocument()
  expect(screen.getByText(/1 USD = 1.4161 CAD/)).toBeInTheDocument()
})

it('shows the rate time on one line without seconds', () => {
  render(<CurrencyConverterMobile c={make()} />)
  const toggle = screen.getByRole('button', { name: /Rate Details/ })
  expect(toggle).toHaveTextContent(/^Rate Details \(Live, as of .*6:42.*\)$/)
  expect(toggle.textContent).not.toMatch(/6:42:41/)
})

it('says manual override when a rate is overridden and offers Use Live', () => {
  const c = make({ override: 1.5 })
  render(<CurrencyConverterMobile c={c} />)
  const toggle = screen.getByRole('button', { name: /Rate Details/ })
  expect(toggle).toHaveTextContent('Rate Details (manual override)')
  fireEvent.click(toggle)
  fireEvent.click(screen.getByRole('button', { name: 'Use Live' }))
  expect(c.clearOverride).toHaveBeenCalled()
})

it('swaps and refreshes from the icon buttons', () => {
  const c = make()
  render(<CurrencyConverterMobile c={c} />)
  fireEvent.click(screen.getByRole('button', { name: 'Swap currencies' }))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh rate' }))
  expect(c.swap).toHaveBeenCalled()
  expect(c.fx.refresh).toHaveBeenCalled()
})
