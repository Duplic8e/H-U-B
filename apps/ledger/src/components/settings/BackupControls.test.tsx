import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { BackupControls } from './BackupControls'
import { useBudgetStore } from '../../store/useBudgetStore'
import { DEMO_FLAG_KEY } from '../../utils/demoData'

describe('BackupControls', () => {
  beforeEach(() => {
    localStorage.clear()
    useBudgetStore.setState({ transactions: {}, categories: {}, categoryGroups: {} })
  })

  it('renders export and import controls', () => {
    render(<BackupControls />)
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/import/i)).toBeInTheDocument()
  })

  it('shows an error for an invalid import file', async () => {
    render(<BackupControls />)
    const input = screen.getByLabelText(/import/i) as HTMLInputElement
    const file = new File(['{bad'], 'x.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/invalid ledger backup/i)).toBeInTheDocument())
  })

  it('requires confirmation before loading demo data over existing real data, and does not touch data until confirmed', () => {
    useBudgetStore.setState({
      transactions: { 'real-tx-1': { id: 'real-tx-1', date: '2026-01-01', amount: 10, description: 'Coffee', type: 'expense', categoryId: 'real-cat-1' } },
      categories: { 'real-cat-1': { id: 'real-cat-1', groupId: 'real-group-1', name: 'Food', targetAmount: 100 } },
      categoryGroups: { 'real-group-1': { id: 'real-group-1', name: 'Everyday', kind: 'expense' } },
    })

    render(<BackupControls />)
    fireEvent.click(screen.getByRole('button', { name: /load demo data/i }))

    // Confirmation dialog appears; real data must still be intact.
    expect(screen.getByText(/load demo data\?/i)).toBeInTheDocument()
    expect(useBudgetStore.getState().transactions['real-tx-1']).toBeDefined()
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(1)

    // Confirming proceeds with the overwrite.
    fireEvent.click(screen.getByRole('button', { name: /replace with demo data/i }))
  })

  it('loads demo data without a confirmation when the store is genuinely empty', () => {
    render(<BackupControls />)
    fireEvent.click(screen.getByRole('button', { name: /load demo data/i }))

    expect(screen.queryByText(/load demo data\?/i)).not.toBeInTheDocument()
    expect(Object.keys(useBudgetStore.getState().transactions).length).toBeGreaterThan(0)
    expect(localStorage.getItem(DEMO_FLAG_KEY)).toBe('on')
  })

  it('clearing demo data removes only demo-prefixed records, leaving real records (including ones added during a demo session) intact', () => {
    localStorage.setItem(DEMO_FLAG_KEY, 'on')
    useBudgetStore.setState({
      transactions: {
        'demo-tx-1': { id: 'demo-tx-1', date: '2026-01-01', amount: 50, description: 'Grocery run', type: 'expense', categoryId: 'demo-cat-1' },
        'real-tx-added-during-demo': { id: 'real-tx-added-during-demo', date: '2026-01-02', amount: 20, description: 'Real purchase', type: 'expense', categoryId: 'real-cat-1' },
      },
      categories: {
        'demo-cat-1': { id: 'demo-cat-1', groupId: 'demo-group-expense', name: 'Groceries', targetAmount: 400 },
        'real-cat-1': { id: 'real-cat-1', groupId: 'real-group-1', name: 'Food', targetAmount: 100 },
      },
      categoryGroups: {
        'demo-group-expense': { id: 'demo-group-expense', name: 'Everyday', kind: 'expense' },
        'real-group-1': { id: 'real-group-1', name: 'Real Group', kind: 'expense' },
      },
    })

    render(<BackupControls />)
    fireEvent.click(screen.getByRole('button', { name: /clear demo data/i }))

    const state = useBudgetStore.getState()
    expect(state.transactions['demo-tx-1']).toBeUndefined()
    expect(state.categories['demo-cat-1']).toBeUndefined()
    expect(state.categoryGroups['demo-group-expense']).toBeUndefined()
    expect(state.transactions['real-tx-added-during-demo']).toBeDefined()
    expect(state.categories['real-cat-1']).toBeDefined()
    expect(state.categoryGroups['real-group-1']).toBeDefined()
  })
})
