import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'
import { CSVUploader } from './CSVUploader'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useTriageStore } from '../../store/useTriageStore'
import { parseCSV } from '../../utils/csvParser'
import type { ExclusionRuleDraft } from '../../types/exclusionRules'

const initialTriage = useTriageStore.getState()
const initialBudget = useBudgetStore.getState()
beforeEach(() => {
  useTriageStore.setState(initialTriage, true)
  useBudgetStore.setState(initialBudget, true)
})

it('aggregates exclusions separately from skips across multiple import sources', async () => {
  const store = useTriageStore.getState()
  const first = store.createImportSource('Card A', 'cibc:1234:5678')
  const second = store.createImportSource('Card B', 'cibc:1234:9999')
  const draft: ExclusionRuleDraft = {
    name: 'Payments', sourceId: first, description: { operator: 'exact', value: 'PAYMENT' },
    direction: 'out', amount: { operator: 'any' }, behavior: 'automatic',
  }
  store.saveExclusionRule(draft)
  store.importTransactions([{ id: 'known', date: '2026-06-09', description: 'Coffee', amount: 5, type: 'expense' }], second)
  render(<CSVUploader />)
  const csv = '2026-06-10,PAYMENT,50.00,,1234********5678\n' +
    '2026-06-09,Coffee,5.00,,1234********9999\n2026-06-10,Shop,10.00,,1234********9999'
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File([csv], 'cards.csv')] } })
  await waitFor(() => expect(useTriageStore.getState().lastImport?.addedIds).toHaveLength(2))
  const report = useTriageStore.getState().lastImport!
  expect(report.excludedIds).toHaveLength(1)
  expect(report.skippedIds).toEqual(['known'])
  expect(report.addedIds).toContain(report.excludedIds![0])
  expect(report.addedIds.length - report.excludedIds!.length).toBe(1)
})

async function chooseNewSource() {
  await screen.findByRole('dialog', { name: 'Choose Import Source' })
  fireEvent.change(screen.getByLabelText('Card or account name'), { target: { value: 'My card' } })
  fireEvent.click(screen.getByRole('button', { name: 'Import transactions' }))
}

vi.mock('../../utils/csvParser', async () => {
  const actual = await vi.importActual<typeof import('../../utils/csvParser')>('../../utils/csvParser')
  return { ...actual, parseCSV: vi.fn(actual.parseCSV) }
})

describe('CSVUploader mapping sheet', () => {
  it('renders when open and closes via scrim', async () => {
    setMatchMedia(true)
    vi.mocked(parseCSV).mockResolvedValueOnce({
      unrecognized: true,
      headers: ['Date', 'Amount', 'Description'],
      rows: [{ Date: '2024-01-01', Amount: '10', Description: 'Test' }],
    })
    render(<CSVUploader />)

    const file = new File(['Date,Amount,Description\n2024-01-01,10,Test'], 'test.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const panel = await waitFor(() => screen.getByTestId('sheet-panel'))
    expect(panel).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sheet-scrim'))
    await waitFor(() => expect(screen.queryByTestId('sheet-panel')).not.toBeInTheDocument())
  })
})

describe('CSVUploader import button (mobile de-duplication)', () => {
  it('is accessible via aria-label and collapses its text label below sm', () => {
    render(<CSVUploader />)

    const button = screen.getByRole('button', { name: 'Import CSV' })
    expect(button).toBeInTheDocument()

    const label = button.querySelector('span')
    expect(label).toBeTruthy()
    expect(label!.className.split(/\s+/)).toContain('hidden')
    expect(label!.className.split(/\s+/)).toContain('sm:inline')
  })
})

describe('CSVUploader on a phone', () => {
  afterEach(() => resetMatchMedia())

  it('is an icon-only ghost button that keeps its name and the mapping sheet', async () => {
    setMatchMedia(false)
    render(<CSVUploader />)
    const button = screen.getByRole('button', { name: 'Import CSV' })
    expect(button.getAttribute('title')).toBe('Import CSV')
    expect(button.textContent).toBe('')
    expect(button.querySelector('svg')!.getAttribute('width')).toBe('20')
    const classes = button.className.split(/\s+/)
    expect(classes).not.toContain('border')
    expect(classes).toContain('h-11')
    expect(classes).toContain('w-11')
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1)
  })
})

it('holds a legacy row for review because its original card is unknown', async () => {
  useBudgetStore.setState({
    transactions: {
      e1: { id: 'e1', date: '2026-08-04', amount: 42.5, description: 'TIM HORTONS #123', type: 'expense' },
    },
  })
  const csv = 'Date,Amount,Description\n2026-08-04,-42.50,Tim Hortons #123\n2026-08-05,-9.00,Coffee\n'
  render(<CSVUploader />)
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File([csv], 'stmt.csv', { type: 'text/csv' })] } })
  await chooseNewSource()

  await waitFor(() => {
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toHaveLength(2)
  })
  const pending = Object.values(useTriageStore.getState().pendingTransactions)
  expect(pending.find((p) => p.description === 'Tim Hortons #123')?.duplicate).toBe('possible')
  expect(pending.find((p) => p.description === 'Coffee')?.duplicate).toBeUndefined()
})

describe('CSVUploader Chase category fallback', () => {
  it('uses the Chase category only when no learned rule matches', async () => {
    useBudgetStore.setState({
      ...useBudgetStore.getState(),
      categoryGroups: { g1: { id: 'g1', name: 'Expenses', kind: 'expense' } },
      categories: {
        cg: { id: 'cg', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        cp: { id: 'cp', groupId: 'g1', name: 'Personal', targetAmount: 0 },
      },
    })
    useTriageStore.setState({ pendingTransactions: {}, categoryRules: { lidl: 'cp' } })

    vi.mocked(parseCSV).mockResolvedValueOnce([
      {
        id: 'r1', date: '2026-08-22', amount: 4.29, description: 'LIDL #1590', type: 'expense',
        originalRowData: { Category: 'Groceries' },
      },
      {
        id: 'r2', date: '2026-08-22', amount: 11.38, description: 'TARGET T-3284', type: 'expense',
        originalRowData: { Category: 'Shopping' },
      },
    ])

    render(<CSVUploader />)
    const file = new File(['x'], 'chase.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    await chooseNewSource()

    await waitFor(() => {
      const pending = useTriageStore.getState().pendingTransactions
      // The learned "lidl" rule wins over Chase's own Groceries category, and a
      // rule match goes straight into the budget instead of waiting.
      expect(useBudgetStore.getState().transactions['r1'].categoryId).toBe('cp')
      expect(pending['r1']).toBeUndefined()
      // No rule matches TARGET, so Chase's Shopping maps to Personal, and a
      // bank's guess still waits for a person to confirm it.
      expect(pending['r2'].categoryId).toBe('cp')
    })
  })
})

it('imports CIBC rows directly into categorized triage with refund, payment and duplicate semantics', async () => {
  useBudgetStore.setState({
    categoryGroups: { g1: { id: 'g1', name: 'Expenses', kind: 'expense' } },
    categories: { cg: { id: 'cg', groupId: 'g1', name: 'Groceries', targetAmount: 0 } },
    transactions: { e1: { id: 'e1', date: '2026-10-06', amount: 15.99,
      description: 'SHOP, OTTAWA ON', type: 'expense' } },
  })
  useTriageStore.setState({ pendingTransactions: {}, categoryRules: { shop: 'cg' } })
  render(<CSVUploader />)
  const csv = '2026-10-06,"SHOP, OTTAWA ON",15.99,,1234********5678\n' +
    '2026-10-06,"SHOP, OTTAWA ON",,27.11,1234********5678\n' +
    '2026-10-06,PAYMENT THANK YOU/PAIEMEN T MERCI,,100.00,1234********5678\n'
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [new File([csv], 'cibc.csv', { type: 'text/csv' })] },
  })
  await waitFor(() => expect(Object.values(useTriageStore.getState().pendingTransactions)).toHaveLength(3))
  const rows = Object.values(useTriageStore.getState().pendingTransactions)
  expect(rows.find(r => r.amount === 15.99)).toMatchObject({ type: 'expense', categoryId: 'cg', duplicate: 'possible' })
  expect(rows.find(r => r.amount === -27.11)).toMatchObject({ type: 'expense', categoryId: 'cg' })
  expect(rows.find(r => r.amount === 100)).toMatchObject({ flag: 'card-payment' })
  expect(screen.queryByRole('dialog', { name: 'Map CSV Columns' })).not.toBeInTheDocument()
})

it('cancels source selection without adding rows or remembered decisions', async () => {
  render(<CSVUploader />)
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['Date,Amount,Description\n2026-06-10,-5,Coffee'], 'bank.csv')] } })
  await screen.findByRole('dialog', { name: 'Choose Import Source' })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(useTriageStore.getState().pendingTransactions).toEqual({})
  expect(useTriageStore.getState().importRecords).toEqual({})
  expect(useTriageStore.getState().importSources).toEqual({})
})

it('automatically routes CIBC cards and skips a repeated day after it was accepted', async () => {
  render(<CSVUploader />)
  const csv = '2026-06-10,Coffee,5.00,,1234********5678\n2026-06-10,Coffee,5.00,,1234********5678'
  const input = document.querySelector('input[type="file"]')!
  fireEvent.change(input, { target: { files: [new File([csv], 'first.csv')] } })
  await waitFor(() => expect(Object.keys(useTriageStore.getState().pendingTransactions)).toHaveLength(2))
  expect(Object.values(useTriageStore.getState().pendingTransactions).every(tx => !tx.duplicate)).toBe(true)
  useTriageStore.getState().approveAll()
  fireEvent.change(input, { target: { files: [new File([csv], 'different-name.csv')] } })
  await waitFor(() => expect(useTriageStore.getState().lastImport?.skippedIds).toHaveLength(2))
  expect(useTriageStore.getState().pendingTransactions).toEqual({})
  expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(2)
})

it('lets a newly recognized CIBC card reuse a previously named source', async () => {
  const store = useTriageStore.getState()
  const sourceId = store.createImportSource('My card')
  store.importTransactions([{ id: 'a', date: '2026-06-10', amount: 5, description: 'Coffee', type: 'expense' }], sourceId)
  store.approveAll()
  render(<CSVUploader />)
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['2026-06-10,Coffee,5.00,,1234********5678'], 'cibc.csv')] } })
  await screen.findByRole('dialog', { name: 'Choose Import Source' })
  fireEvent.click(screen.getByRole('button', { name: 'Import source' }))
  fireEvent.click(screen.getByRole('option', { name: 'My card' }))
  fireEvent.click(screen.getByRole('button', { name: 'Import transactions' }))
  expect(useTriageStore.getState().importSources[sourceId].bankKey).toBe('cibc:1234:5678')
  expect(useTriageStore.getState().pendingTransactions).toEqual({})
  expect(useTriageStore.getState().lastImport?.skippedIds).toHaveLength(1)
})

it('reserves a manual source for one card while planning a multi-card file and cancels without partial writes', async () => {
  const sourceId = useTriageStore.getState().createImportSource('My card')
  render(<CSVUploader />)
  const csv = '2026-06-10,Coffee,5.00,,1234********5678\n2026-06-10,Coffee,5.00,,1234********9999'
  const input = document.querySelector('input[type="file"]')!
  const selectFirst = async () => {
    fireEvent.change(input, { target: { files: [new File([csv], 'cards.csv')] } })
    await screen.findByRole('dialog', { name: 'Choose Import Source' })
    fireEvent.click(screen.getByRole('button', { name: 'Import source' }))
    fireEvent.click(screen.getByRole('option', { name: 'My card' }))
    fireEvent.click(screen.getByRole('button', { name: 'Import transactions' }))
  }
  await selectFirst()
  expect(useTriageStore.getState().importRecords).toEqual({})
  fireEvent.click(screen.getByRole('button', { name: 'Import source' }))
  expect(screen.queryByRole('option', { name: 'My card' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: 'New card or account' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(useTriageStore.getState().importSources[sourceId].bankKey).toBeUndefined()
  expect(useTriageStore.getState().importRecords).toEqual({})
  await selectFirst()
  fireEvent.click(screen.getByRole('button', { name: 'Import transactions' }))
  expect(Object.keys(useTriageStore.getState().importSources)).toHaveLength(2)
  expect(Object.keys(useTriageStore.getState().pendingTransactions)).toHaveLength(2)
  expect(useTriageStore.getState().lastImport?.addedIds).toHaveLength(2)
})


it('rejects incompatible learned and heuristic category guesses without changing incoming classification', async () => {
  useBudgetStore.setState({ categories: { g: { id: 'g', name: 'Groceries', groupId: 'food', targetAmount: 0 } }, categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' } } })
  useTriageStore.setState({ categoryRules: { Transfer: 'g' } })
  render(<CSVUploader />)
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['2026-06-10,Transfer,,40.00,1234********5678'], 'receipt.csv')] } })
  await waitFor(() => expect(Object.keys(useTriageStore.getState().pendingTransactions)).toHaveLength(1))
  const receipt = Object.values(useTriageStore.getState().pendingTransactions)[0]
  expect(receipt).toMatchObject({ amount: -40, type: 'expense', categoryId: 'g' })
  // Ordinary received payments parsed as income cannot use the expense rule.
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['Date,Amount,Description\n2026-06-11,40,Transfer'], 'incoming.csv')] } })
  await screen.findByRole('dialog', { name: 'Choose Import Source' })
  fireEvent.click(screen.getByRole('button', { name: 'Import source' }))
  fireEvent.click(screen.getByRole('option', { name: 'New card or account' }))
  await chooseNewSource()
  const incoming = Object.values(useTriageStore.getState().pendingTransactions).find(tx => tx.type === 'income')!
  expect(incoming.categoryId).toBeUndefined()
  expect(incoming.amount).toBe(40)
})


it('rejects incompatible Chase fallback guesses and permits a compatible fallback after an incompatible learned rule', async () => {
  useBudgetStore.setState({ categories: { g: { id: 'g', name: 'Groceries', groupId: 'food', targetAmount: 0 }, s: { id: 's', name: 'Salary', groupId: 'earn', targetAmount: 0 } }, categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' }, earn: { id: 'earn', name: 'Income', kind: 'income' } } })
  useTriageStore.setState({ categoryRules: { Transfer: 's' } })
  vi.mocked(parseCSV).mockResolvedValueOnce([
    { id: 'receipt', date: '2026-10-13', amount: 40, description: 'Receipt', type: 'income', originalRowData: { Category: 'Groceries' } },
    { id: 'purchase', date: '2026-10-13', amount: 40, description: 'Transfer', type: 'expense', originalRowData: { Category: 'Groceries' } },
  ])
  render(<CSVUploader />)
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['x'], 'chase.csv')] } })
  await chooseNewSource()
  expect(useTriageStore.getState().pendingTransactions.receipt.categoryId).toBeUndefined()
  expect(useTriageStore.getState().pendingTransactions.purchase.categoryId).toBe('g')
  expect(useTriageStore.getState().categoryRules.Transfer).toBe('s')
})
