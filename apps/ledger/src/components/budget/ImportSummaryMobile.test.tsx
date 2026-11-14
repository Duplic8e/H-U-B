import { fireEvent, render, screen, within } from '@testing-library/react'
import { ImportSummaryMobile } from './ImportSummaryMobile'
import { useTriageStore } from '../../store/useTriageStore'

const initial = useTriageStore.getState()

const rec = (id: string, description: string, decision: 'accepted' | 'ignored' | 'pending' | 'duplicate') => ({
  id, sourceId: 'src', original: { id, date: '2026-10-01', amount: 10, description, type: 'expense' as const }, decision,
})

const seed = (changedDays: { sourceId: string; date: string; missingCount: number; signature: string; recordIds: string[] }[] = []) =>
  useTriageStore.setState({
    importSources: { src: { id: 'src', name: 'CIBC card 1471' } } as never,
    importRecords: {
      s1: rec('s1', 'TIM HORTONS', 'accepted'),
      s2: rec('s2', 'SHELL', 'ignored'),
      x1: rec('x1', 'E-TRANSFER SENT', 'ignored'),
    } as never,
    lastImport: { addedIds: ['a', 'b', 'c', 'x1'], skippedIds: ['s1', 's2'], excludedIds: ['x1'], changedDays } as never,
  })

beforeEach(() => useTriageStore.setState(initial, true))

it('renders nothing without an import report', () => {
  const { container } = render(<ImportSummaryMobile />)
  expect(container).toBeEmptyDOMElement()
})

it('shows one row per outcome with counts', () => {
  seed()
  render(<ImportSummaryMobile />)
  const card = screen.getByTestId('import-summary-mobile')
  expect(within(card).getByText('To Categorize')).toBeInTheDocument()
  expect(within(card).getByText('3')).toBeInTheDocument()
  expect(within(card).getByText('2')).toBeInTheDocument()
  expect(within(card).getByText('1')).toBeInTheDocument()
  expect(screen.queryByText(/Nothing was deleted/)).not.toBeInTheDocument()
})

it('opens the skipped list and restores an ignored row', () => {
  seed()
  render(<ImportSummaryMobile />)
  fireEvent.click(screen.getByRole('button', { name: /Skipped/ }))
  const sheet = screen.getByRole('dialog', { name: 'Skipped' })
  expect(within(sheet).getByText(/TIM HORTONS/)).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: 'What does this mean?' })).not.toBeInTheDocument()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Review again' }))
  expect(useTriageStore.getState().importRecords.s2.decision).toBe('pending')
})

it('explains missing charges behind an info button', () => {
  seed([{ sourceId: 'src', date: '2026-10-03', missingCount: 2, signature: 'x', recordIds: [] }])
  render(<ImportSummaryMobile />)
  fireEvent.click(screen.getByRole('button', { name: /Skipped/ }))
  expect(screen.queryByText(/does not have/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'What does this mean?' }))
  expect(screen.getByText(/included 2 charges dated 2026-10-03/)).toBeInTheDocument()
  expect(screen.getByText(/Nothing was deleted/)).toBeInTheDocument()
})

it('lists excluded rows and hands off to Excluded Imports', () => {
  seed()
  const onViewExcluded = vi.fn()
  render(<ImportSummaryMobile onViewExcluded={onViewExcluded} />)
  fireEvent.click(screen.getByRole('button', { name: /Excluded/ }))
  expect(screen.getByText(/E-TRANSFER SENT/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Manage Excluded Imports' }))
  expect(onViewExcluded).toHaveBeenCalledTimes(1)
})
