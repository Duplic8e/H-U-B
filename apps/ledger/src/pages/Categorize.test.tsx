import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Categorize } from './Categorize'
import { useTriageStore } from '../store/useTriageStore'
import { useBudgetStore } from '../store/useBudgetStore'
import { useUndoStore } from '../store/useUndoStore'

const triageInitial = useTriageStore.getState()
const budgetInitial = useBudgetStore.getState()

const today = new Date()
const iso = (daysAgo: number) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  useTriageStore.setState(triageInitial, true)
  useBudgetStore.setState(budgetInitial, true)
  useBudgetStore.setState({
    categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' } },
    categories: { groceries: { id: 'groceries', groupId: 'food', name: 'Groceries', targetAmount: 0 } },
  })
  useTriageStore.getState().addPending([
    { id: 'a', date: iso(2), description: 'LOBLAWS #1234 TORONTO ON', amount: 80, type: 'expense' },
    { id: 'b', date: iso(20), description: 'LOBLAWS #5678 NORTH YORK ON', amount: 40, type: 'expense' },
    { id: 'old', date: iso(400), description: 'LOBLAWS #1 BARRIE ON', amount: 10, type: 'expense' },
    { id: 'c', date: iso(1), description: 'TIM HORTONS #22 OTTAWA ON', amount: 3, type: 'expense' },
  ])
})

const page = () => render(<MemoryRouter><Categorize /></MemoryRouter>)

it('groups the last 3 months by store, newest first', () => {
  page()
  expect(screen.getByText('4')).toBeInTheDocument() // left to categorize, all time
  const groups = screen.getAllByTestId('merchant-group')
  expect(groups.map((g) => within(g).getByRole('heading').textContent)).toEqual(['Tim Hortons', 'Loblaws'])
  expect(within(groups[1]).getByText(/2 transactions/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'All' }))
  expect(within(screen.getAllByTestId('merchant-group')[1]).getByText(/3 transactions/)).toBeInTheDocument()
})

it('files a whole store with one choice, older rows included, and can undo it', () => {
  page()
  fireEvent.change(screen.getByLabelText('Category for Loblaws'), { target: { value: 'groceries' } })
  expect(useBudgetStore.getState().transactions.old?.categoryId).toBe('groceries')
  expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['c'])
  expect(useUndoStore.getState().pending?.label).toBe('Filed 2 Loblaws as Groceries, plus 1 more from the same store')
  expect(screen.queryByLabelText('Category for Loblaws')).toBeNull()

  useUndoStore.getState().pending!.undo()
  expect(useBudgetStore.getState().transactions.a).toBeUndefined()
  expect(useTriageStore.getState().categoryRules).toEqual({})
  expect(Object.keys(useTriageStore.getState().pendingTransactions).sort()).toEqual(['a', 'b', 'c', 'old'])
})

it('leaves a store out of the budget when it is not spending', () => {
  page()
  fireEvent.change(screen.getByLabelText('Category for Tim Hortons'), { target: { value: '__not-spending__' } })
  expect(useTriageStore.getState().pendingTransactions.c).toBeUndefined()
  expect(useBudgetStore.getState().transactions.c).toBeUndefined()
})

it('says when everything is done', () => {
  useTriageStore.setState({ pendingTransactions: {} })
  page()
  expect(screen.getByText('All caught up')).toBeInTheDocument()
})

it('makes a new category and group on the spot and files the store into it', async () => {
  page()
  fireEvent.click(screen.getByRole('button', { name: 'New category for Tim Hortons' }))
  const sheet = await screen.findByRole('dialog', { name: 'New category' })
  fireEvent.change(within(sheet).getByLabelText('Category name'), { target: { value: 'Coffee' } })
  fireEvent.change(within(sheet).getByLabelText('Group'), { target: { value: '__new-group__' } })
  expect(within(sheet).getByRole('button', { name: 'Add Category' })).toBeDisabled()
  fireEvent.change(within(sheet).getByLabelText('New group name'), { target: { value: 'Treats' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add Category' }))

  const budget = useBudgetStore.getState()
  const coffee = Object.values(budget.categories).find((c) => c.name === 'Coffee')!
  expect(budget.categoryGroups[coffee.groupId]).toMatchObject({ name: 'Treats', kind: 'expense' })
  expect(budget.transactions.c.categoryId).toBe(coffee.id)
  expect(useTriageStore.getState().categoryRules['tim hortons']).toBe(coffee.id)
})

it('offers New category from the picker too, into an existing group', async () => {
  page()
  fireEvent.change(screen.getByLabelText('Category for Loblaws'), { target: { value: '__new-category__' } })
  const sheet = await screen.findByRole('dialog', { name: 'New category' })
  expect(within(sheet).getByLabelText('Group')).toHaveValue('food')
  fireEvent.change(within(sheet).getByLabelText('Category name'), { target: { value: 'Bulk Food' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add Category' }))
  const bulk = Object.values(useBudgetStore.getState().categories).find((c) => c.name === 'Bulk Food')!
  expect(bulk.groupId).toBe('food')
  expect(useBudgetStore.getState().transactions.a.categoryId).toBe(bulk.id)
})

it('moves set-aside transfers into the queue on request', () => {
  useTriageStore.getState().addPending([{ id: 't', date: iso(3), description: 'INTERNET TRANSFER 000000000001', amount: 300, type: 'expense', flag: 'card-payment' }])
  page()
  fireEvent.click(screen.getByRole('button', { name: 'Categorize them too' }))
  expect(screen.getByLabelText('Category for Internet Transfer')).toBeInTheDocument()
})

it('sorts stores by number of transactions and remembers the choice', () => {
  localStorage.removeItem('ledger-categorize-sort')
  const { unmount } = page()
  const names = () => screen.getAllByTestId('merchant-group').map((g) => within(g).getByRole('heading').textContent)
  expect(names()).toEqual(['Tim Hortons', 'Loblaws'])
  fireEvent.change(screen.getByLabelText('Sort stores'), { target: { value: 'most' } })
  expect(names()).toEqual(['Loblaws', 'Tim Hortons'])
  unmount()
  page()
  expect(screen.getByLabelText('Sort stores')).toHaveValue('most')
  localStorage.removeItem('ledger-categorize-sort')
})
