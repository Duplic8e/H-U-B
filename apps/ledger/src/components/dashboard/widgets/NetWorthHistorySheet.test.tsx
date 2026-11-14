import { render, screen, fireEvent } from '@testing-library/react'
import { NetWorthHistorySheet } from './NetWorthHistorySheet'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { STORAGE_KEYS } from '../../../store/storageKeys'

const initialState = useAccountsStore.getState()

beforeEach(() => {
  useAccountsStore.setState(initialState, true)
})

describe('NetWorthHistorySheet', () => {
  it('lists existing snapshots newest first', () => {
    useAccountsStore.setState({
      accounts: [],
      history: [{ date: '2026-06-01', value: 50 }, { date: '2026-08-01', value: 100 }],
    })
    render(<NetWorthHistorySheet open onClose={() => {}} />)
    const rows = screen.getAllByTestId('snapshot-row')
    expect(rows[0].textContent).toContain('2026-08-01')
    expect(rows[1].textContent).toContain('2026-06-01')
  })

  it('adds a backfilled snapshot', () => {
    useAccountsStore.setState({ accounts: [], history: [] })
    render(<NetWorthHistorySheet open onClose={() => {}} />)
    // ThemedDatePicker is a button that opens a calendar grid popover, not a
    // native input, so picking a date means clicking through it the same way
    // ThemedDatePicker.test.tsx does, not firing a change event.
    fireEvent.click(screen.getByLabelText('Snapshot date'))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(screen.getByRole('gridcell', { name: '15' }))
    const now = new Date()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)
    const expectedDate = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-15`

    const amount = screen.getByLabelText('Snapshot value')
    fireEvent.change(amount, { target: { value: '42000' } })
    fireEvent.blur(amount)
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }))
    expect(useAccountsStore.getState().history).toEqual([{ date: expectedDate, value: 42000 }])
  })

  it('deletes a snapshot', () => {
    useAccountsStore.setState({ accounts: [], history: [{ date: '2026-08-01', value: 100 }] })
    render(<NetWorthHistorySheet open onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('Delete snapshot for 2026-08-01'))
    expect(useAccountsStore.getState().history).toEqual([])
  })

  it('explains the persisted currency marker for earlier totals and keeps CAD implicit for manual entry', () => {
    useAccountsStore.setState({ currencySupportStartedAt: '2026-10-06', history: [{ date: '2026-09-01', value: 100 }] })
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.accounts) ?? '{}') as { state?: { currencySupportStartedAt?: string } }
    expect(saved.state?.currencySupportStartedAt).toBe('2026-10-06')
    render(<NetWorthHistorySheet open onClose={() => {}} />)
    expect(screen.getByText(/Currency support began on 2026-10-06/)).toBeTruthy()
    expect(screen.getByText(/Earlier totals may have treated foreign balances as CAD/)).toBeTruthy()
    expect(screen.getByLabelText('Snapshot value')).toBeTruthy()
  })
})
