import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CompensationModal } from './CompensationModal'
import { useCompensationStore } from '../../store/useCompensationStore'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
})

// Several numeric fields in this modal have a visible <label> that is not
// programmatically associated (no htmlFor/aria-label), so getByLabelText
// can't find them. Locate the label by its text, then grab the input that
// follows it within the same field wrapper.
function inputAfterLabel(text: string | RegExp): HTMLInputElement {
  const label = screen.getByText(text)
  const input = label.parentElement?.querySelector('input')
  if (!input) throw new Error(`No input found after label matching ${text}`)
  return input as HTMLInputElement
}

describe('CompensationModal ticker field', () => {
  it('saves an uppercased, trimmed ticker on submit', () => {
    render(<CompensationModal isOpen={true} onClose={() => {}} />)
    const tickerInput = screen.getByLabelText(/ticker/i)
    fireEvent.change(tickerInput, { target: { value: ' aapl ' } })
    fireEvent.click(screen.getByRole('button', { name: /save compensation package/i }))
    expect(useCompensationStore.getState().primaryPackage.companyTicker).toBe('AAPL')
  })
})

describe('CompensationModal numeric field submission (NumberInput conversion)', () => {
  it('submits base salary and stock price as numbers via the Base & Cash tab', () => {
    render(<CompensationModal isOpen={true} onClose={() => {}} />)

    const stockPriceInput = inputAfterLabel(/company current stock price/i)
    fireEvent.change(stockPriceInput, { target: { value: '250' } })

    const baseSalaryInput = inputAfterLabel(/current base salary/i)
    fireEvent.change(baseSalaryInput, { target: { value: '150000' } })

    const bonusInput = inputAfterLabel(/cash bonus/i)
    fireEvent.change(bonusInput, { target: { value: '12' } })

    fireEvent.click(screen.getByRole('button', { name: /save compensation package/i }))

    const saved = useCompensationStore.getState().primaryPackage
    expect(saved.companyCurrentPrice).toBe(250)
    expect(saved.baseSalary).toBe(150000)
    expect(saved.cashBonusPercent).toBe(12)
  })

  it('adds an RSU grant with numeric shares and price from the Equity tab', () => {
    render(<CompensationModal isOpen={true} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /^equity$/i }))

    const nameInput = inputAfterLabel(/rsu grant name/i)
    fireEvent.change(nameInput, { target: { value: 'Initial Grant' } })

    const sharesInput = inputAfterLabel(/number of shares/i)
    fireEvent.change(sharesInput, { target: { value: '500' } })

    const priceInput = inputAfterLabel(/grant price/i)
    fireEvent.change(priceInput, { target: { value: '42' } })

    fireEvent.click(screen.getByRole('button', { name: /add rsu grant/i }))

    const grants = useCompensationStore.getState().primaryPackage.rsuGrants
    expect(grants).toHaveLength(1)
    expect(grants[0].grantShares).toBe(500)
    expect(grants[0].grantPrice).toBe(42)
  })
})

describe('CompensationModal scrim dismissal', () => {
  it('closes when the scrim is clicked (desktop)', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<CompensationModal isOpen={true} onClose={onClose} />)
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('CompensationModal mobile header (no double close)', () => {
  afterEach(() => resetMatchMedia())

  it('shows no visible sheet close control on mobile and renders no desktop header there', () => {
    setMatchMedia(false)
    render(<CompensationModal isOpen={true} onClose={() => {}} />)
    // The modal's own header row is desktop-only, so a phone renders it not at all.
    // Sheet renders via createPortal to document.body.
    expect(document.body.querySelector('.hidden.desktop\\:flex')).toBeNull()
    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    expect(closeButtons).toHaveLength(1)
    expect(closeButtons.every((btn) => btn.hasAttribute('data-sheet-hidden-close'))).toBe(true)
    expect(closeButtons.every((btn) => btn.className.split(' ').includes('sr-only'))).toBe(true)
  })
})
