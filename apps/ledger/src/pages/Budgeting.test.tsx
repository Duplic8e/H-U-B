import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { Budgeting } from './Budgeting'
import { useTriageStore } from '../store/useTriageStore'
import { resetMatchMedia, setMatchMedia } from '../test-utils/matchMedia'

function renderBudget() {
  return render(<MemoryRouter><Budgeting /></MemoryRouter>)
}

describe('Budgeting header (mobile de-duplication)', () => {
  afterEach(resetMatchMedia)

  it('labels the period dropdown for screen readers', () => {
    renderBudget()
    // ThemedSelect trigger exposes aria-label as its accessible name
    expect(screen.getByRole('button', { name: 'Time period' })).toBeInTheDocument()
  })

  it('renders the range dropdown on desktop and a Time Period button on a phone', () => {
    renderBudget()
    expect(screen.getByRole('button', { name: 'Time period' }).closest('[data-period-dropdown]')).toBeTruthy()
    cleanup()
    setMatchMedia(false)
    renderBudget()
    expect(screen.queryByRole('button', { name: 'Time period' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Time Period' }).closest('[data-testid="budget-phone-controls"]')).toBeTruthy()
  })

  it('lets a phone pick a range from the Time Period sheet and go back to a month', () => {
    setMatchMedia(false)
    renderBudget()
    fireEvent.click(screen.getByRole('button', { name: 'Time Period' }))
    // The sheet's own choices, not the native <option>s of the Cash Plan period menu.
    expect(screen.getAllByRole('option').filter((o) => o.tagName !== 'OPTION').map((o) => o.textContent)).toEqual(
      ['This Month', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'Last 12 Months', 'Year to Date'],
    )
    fireEvent.click(screen.getByRole('option', { name: 'Last 3 Months' }))
    const row = screen.getByTestId('budget-phone-controls')
    expect(row).toHaveTextContent('Last 3 Months')
    expect(screen.queryByLabelText('Previous Month')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Time Period' }))
    expect(screen.getByRole('option', { name: 'Last 3 Months' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('option', { name: 'This Month' }))
    expect(screen.getByLabelText('Previous Month')).toBeInTheDocument()
  })

  // The arrows keep a 44px touch target at the mobile base width and shrink
  // only from md up, where the row has to line up with the 40px-tall select
  // and the Import CSV / Add Transaction buttons beside it.
  it('gives the month arrows 44px hit areas on mobile and 32px from md up', () => {
    renderBudget()
    for (const label of ['Previous Month', 'Next Month']) {
      const btn = screen.getByLabelText(label)
      const classes = btn.className.split(/\s+/)
      expect(classes).toContain('h-11')
      expect(classes).toContain('w-11')
      expect(classes).toContain('md:h-8')
      expect(classes).toContain('md:w-8')
    }
  })

  it('matches the header controls to a single 40px height from md up', () => {
    renderBudget()
    expect(screen.getByLabelText('Time period').className).toMatch(/\bh-10\b/)
    expect(screen.getByLabelText('Import CSV').className).toMatch(/\bh-10\b/)
    expect(screen.getByRole('button', { name: 'Add Transaction' }).className).toMatch(/\bh-10\b/)
  })
})

describe('Budgeting header on a phone', () => {
  afterEach(() => resetMatchMedia())

  it('moves Add Transaction to the top bar and the month and import controls into one row', () => {
    setMatchMedia(false)
    render(<MemoryRouter><Budgeting /></MemoryRouter>)
    expect(screen.getAllByRole('button', { name: 'Add Transaction' })).toHaveLength(1)
    const row = screen.getByTestId('budget-phone-controls')
    expect(row.querySelector('button[aria-label="Previous Month"]')).not.toBeNull()
    expect(row.querySelector('button[aria-label="Import CSV"]')).not.toBeNull()
    expect(screen.queryByText('Manage your income, track expenses, and view your cash flow.')).toBeNull()
  })

  it('renders the month stepper as a plain inline row with no card chrome', () => {
    setMatchMedia(false)
    render(<MemoryRouter><Budgeting /></MemoryRouter>)
    const row = screen.getByTestId('budget-phone-controls')
    const prev = screen.getByLabelText('Previous Month')
    const stepper = prev.parentElement!
    expect(row.contains(stepper)).toBe(true)
    const classes = stepper.className.split(/\s+/)
    for (const card of ['bg-bg-secondary', 'border', 'shadow-sm', 'rounded-lg', 'p-1']) {
      expect(classes).not.toContain(card)
    }
    // The chevrons keep a 44px hit area around a 20px icon.
    for (const label of ['Previous Month', 'Next Month']) {
      const classes = screen.getByLabelText(label).className.split(/\s+/)
      expect(classes).toContain('h-11')
      expect(classes).toContain('w-11')
      expect(classes).not.toContain('md:h-8')
    }
    expect(prev.querySelector('svg')!.getAttribute('width')).toBe('20')
    const label = stepper.querySelector('span')!
    expect(label.className.split(/\s+/)).toContain('tabular-nums')
    expect(label.className).not.toMatch(/min-w/)
  })

  it('shows Import CSV as an icon-only button on a phone', () => {
    setMatchMedia(false)
    render(<MemoryRouter><Budgeting /></MemoryRouter>)
    const btn = screen.getByRole('button', { name: 'Import CSV' })
    expect(btn.getAttribute('title')).toBe('Import CSV')
    expect(btn.textContent).toBe('')
    expect(btn.className.split(/\s+/)).not.toContain('border')
  })

  it('keeps the desktop stepper card and labelled import button', () => {
    render(<MemoryRouter><Budgeting /></MemoryRouter>)
    const stepper = screen.getByLabelText('Previous Month').parentElement!
    const classes = stepper.className.split(/\s+/)
    for (const card of ['bg-bg-secondary', 'border', 'shadow-sm', 'rounded-lg', 'p-1']) {
      expect(classes).toContain(card)
    }
    expect(screen.getByLabelText('Import CSV').textContent).toContain('Import CSV')
  })

  it('keeps the desktop header as it was', () => {
    render(<MemoryRouter><Budgeting /></MemoryRouter>)
    expect(screen.queryByTestId('budget-phone-controls')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Add Transaction' })).toHaveLength(1)
    expect(screen.getByText('Manage your income, track expenses, and view your cash flow.')).toBeInTheDocument()
  })
})

it('places one exclusion rules widget in Plan and keeps three tabs', () => {
  cleanup()
  renderBudget()
  fireEvent.click(screen.getByRole('tab', { name: 'Plan' }))
  expect(screen.getAllByText('Exclusion Rules (0)')).toHaveLength(1)
  expect(screen.getByRole('tab', { name: 'Transactions' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'This Month' })).toBeInTheDocument()
  expect(screen.getAllByRole('tab').filter((t) => t.closest('[aria-label="Budgeting sections"]'))).toHaveLength(3)
  const category = screen.getByText('Categorization Rules (0)')
  const exclusions = screen.getByText('Exclusion Rules (0)')
  expect(category.compareDocumentPosition(exclusions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('opens and focuses excluded history from the report on another tab', async () => {
  const triageBefore = useTriageStore.getState()
  try {
    useTriageStore.setState({...triageBefore, importRecords:{a:{id:'a',sourceId:'card',decision:'ignored',original:{id:'a',date:'2026-06-10',amount:50,description:'Savings',type:'expense'}}}, lastImport:{addedIds:['a'],excludedIds:['a'],skippedIds:[],changedDays:[]}})
    render(<MemoryRouter initialEntries={['/?tab=overview']}><Budgeting /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button',{name:'View excluded imports'}))
    const details = document.getElementById('excluded-imports') as HTMLDetailsElement
    expect(details).toBeInTheDocument()
    expect(details.open).toBe(true)
    expect(details.querySelector('summary')).toHaveFocus()
    expect(screen.getByRole('tab',{name:'Transactions'})).toHaveAttribute('aria-selected','true')
  } finally { cleanup(); useTriageStore.setState(triageBefore, true) }
})
