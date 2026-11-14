import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { TransactionModal } from './TransactionModal'
import { useBudgetStore, getMonthlyBudgetStats } from '../../store/useBudgetStore'
import { splitParts } from '../../utils/budget/splits'
import { setMatchMedia } from '../../test-utils/matchMedia'

const seed = () =>
  useBudgetStore.setState({
    categoryGroups: {
      gi: { id: 'gi', name: 'Income', kind: 'income' },
      ge: { id: 'ge', name: 'Food', kind: 'expense' },
    },
    categories: {
      salary: { id: 'salary', groupId: 'gi', name: 'Salary', targetAmount: 0 },
      groceries: { id: 'groceries', groupId: 'ge', name: 'Groceries', targetAmount: 0 },
    },
    refundsAndPaymentsEnabled: true,
    transactions: {},
  })

describe('TransactionModal category filtering', () => {
  it('shows only expense categories for expense type', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Category/i }))
    expect(screen.getByRole('option', { name: /groceries/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /salary/i })).not.toBeInTheDocument()
  })

  it('shows only income categories for income type', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    fireEvent.click(screen.getByRole('button', { name: /Category/i }))
    expect(screen.getByRole('option', { name: /salary/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /groceries/i })).not.toBeInTheDocument()
  })
})

describe('TransactionModal shared bill and reimbursement controls', () => {
  it.each([['50%', 60], ['33%', 40], ['25%', 30]])('uses the entered transaction total for My share %s and preserves it after reopening', (label, share) => {
    seed()
    const view = render(<TransactionModal isOpen onClose={() => {}} />)
    const amount = screen.getByLabelText('Amount')
    fireEvent.change(amount, { target: { value: '120' } })
    fireEvent.blur(amount)
    fireEvent.click(screen.getByLabelText(/shared bill/i))
    fireEvent.click(screen.getByRole('button', { name: `My share ${label}` }))
    expect(amount).toHaveValue(String(share))
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex, roommates/i), { target: { value: 'Alex' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }))
    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.amount).toBe(share)
    expect(saved.shared).toEqual({ totalAmount: 120, sharedWith: 'Alex' })
    view.unmount()
    render(<TransactionModal isOpen onClose={() => {}} initialTransaction={saved} />)
    expect(screen.getByLabelText('Your share')).toHaveValue(String(share))
    expect(screen.getByLabelText('Total I paid')).toHaveValue('120')
  })

  it('saves a manually entered share when sharing an existing full amount', () => {
    seed()
    const initial = { id: 'bill', type: 'expense' as const, amount: 120, date: '2026-10-06', description: 'Dinner' }
    useBudgetStore.setState({ transactions: { bill: initial } })
    render(<TransactionModal isOpen onClose={() => {}} initialTransaction={initial} />)
    fireEvent.click(screen.getByLabelText(/shared bill/i))
    const amount = document.getElementById('tx-amount')!
    fireEvent.change(amount, { target: { value: '45' } })
    fireEvent.blur(amount)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex, roommates/i), { target: { value: 'Alex' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(useBudgetStore.getState().transactions.bill).toMatchObject({
      amount: 45, shared: { totalAmount: 120, sharedWith: 'Alex' },
    })
  })

  it('adds a shared expense with the user share as amount and the remainder owed', () => {
    seed()
    const onClose = vi.fn()
    render(<TransactionModal isOpen onClose={onClose} />)

    fireEvent.click(screen.getByLabelText(/shared bill/i))
    const totalInput = screen.getAllByPlaceholderText('0.00')[1] as HTMLInputElement
    fireEvent.change(totalInput, { target: { value: '120' } })
    fireEvent.blur(totalInput)

    fireEvent.click(screen.getByRole('button', { name: /my share 50%/i }))

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex, roommates/i), {
      target: { value: 'Alex' },
    })

    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))

    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.amount).toBe(60)
    expect(saved.shared).toEqual({ totalAmount: 120, sharedWith: 'Alex' })
  })

  it('requires a person before saving a shared remainder', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)

    fireEvent.click(screen.getByLabelText(/shared bill/i))
    const totalInput = screen.getAllByPlaceholderText('0.00')[1] as HTMLInputElement
    fireEvent.change(totalInput, { target: { value: '120' } })
    fireEvent.blur(totalInput)
    fireEvent.click(screen.getByRole('button', { name: /my share 50%/i }))

    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))

    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter who owes you the rest of this bill.')
  })

  it('does not erase the amount with a percentage when no total has been entered', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText(/shared bill/i))
    expect(screen.getByRole('button', { name: 'My share 50%' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Your share'), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }))
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('Total I paid must be at least your share.')
  })

  it('adds a reimbursement income with the from field set', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    fireEvent.click(screen.getByLabelText(/reimbursement/i))
    fireEvent.change(screen.getByPlaceholderText(/who paid you back/i), {
      target: { value: 'Alex' },
    })
    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '60' } })
    fireEvent.blur(amountInput)

    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))

    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.reimbursement).toEqual({ from: 'Alex' })
  })

  it('prefills shared fields when editing a shared expense', () => {
    seed()
    useBudgetStore.setState({
      transactions: {
        t1: {
          id: 't1',
          type: 'expense',
          amount: 60,
          categoryId: 'groceries',
          date: '2026-07-01',
          description: 'Dinner',
          shared: { totalAmount: 120, sharedWith: 'Alex' },
        },
      },
    })
    const initial = useBudgetStore.getState().transactions.t1
    render(<TransactionModal isOpen onClose={() => {}} initialTransaction={initial} />)

    expect(screen.getByLabelText(/shared bill/i)).toBeChecked()
    expect(screen.getByDisplayValue('Alex')).toBeInTheDocument()
  })
})

describe('TransactionModal scrim dismissal', () => {
  it('renders when open and closes via scrim', () => {
    seed()
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<TransactionModal isOpen onClose={onClose} />)
    expect(getByTestId('sheet-panel')).toBeInTheDocument()
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('TransactionModal splits, tags and note', () => {
  it('saves the slices the user entered and shows what is left to allocate', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Food', kind: 'expense' } },
      categories: {
        groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        household: { id: 'household', groupId: 'g1', name: 'Household', targetAmount: 0 },
      },
      refundsAndPaymentsEnabled: true,
    transactions: {},
    })
    render(<TransactionModal isOpen onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '180' } })
    fireEvent.blur(screen.getByPlaceholderText('0.00'))
    fireEvent.click(screen.getByLabelText('Split across categories'))
    fireEvent.click(screen.getByRole('button', { name: 'Add a slice' }))

    const sliceAmounts = screen.getAllByLabelText('Slice amount')
    fireEvent.change(sliceAmounts[0], { target: { value: '120' } })
    fireEvent.blur(sliceAmounts[0])

    expect(screen.getByText(/\$60.*left to allocate/i)).toBeInTheDocument()

    fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form') as HTMLFormElement)

    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.amount).toBe(180)
    expect(saved.splits).toEqual([{ categoryId: 'groceries', amount: 120 }])
  })

  it('saves tags lower-cased and de-duplicated, and saves the note', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Food', kind: 'expense' } },
      categories: { groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 } },
      refundsAndPaymentsEnabled: true,
    transactions: {},
    })
    render(<TransactionModal isOpen onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } })
    fireEvent.blur(screen.getByPlaceholderText('0.00'))
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'Trip, trip , Reimbursable' } })
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'split with Sam' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form') as HTMLFormElement)

    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.tags).toEqual(['trip', 'reimbursable'])
    expect(saved.note).toBe('split with Sam')
  })

  it('leaves splits undefined when the user never opens the split editor', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Food', kind: 'expense' } },
      categories: { groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 } },
      refundsAndPaymentsEnabled: true,
    transactions: {},
    })
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } })
    fireEvent.blur(screen.getByPlaceholderText('0.00'))
    fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form') as HTMLFormElement)

    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.splits).toBeUndefined()
    expect(saved.tags).toBeUndefined()
  })
})

describe('TransactionModal negative amounts', () => {
  const setAmount = (value: string) => {
    const input = screen.getAllByPlaceholderText('0.00')[0] as HTMLInputElement
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input)
  }

  const submit = () => fireEvent.click(screen.getByRole('button', { name: /add transaction|save/i }))

  it('still rejects a negative income', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    setAmount('-10')
    submit()

    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero.')
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  })

  it('still rejects an amount of exactly zero', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)
    setAmount('0')
    submit()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  })
})

describe('TransactionModal negative expense splitting is out of scope', () => {
  const setAmount = (value: string) => {
    const input = screen.getAllByPlaceholderText('0.00')[0] as HTMLInputElement
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input)
  }

  it('refuses to save when the slices exceed the amount', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Food', kind: 'expense' } },
      categories: {
        groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        household: { id: 'household', groupId: 'g1', name: 'Household', targetAmount: 0 },
      },
      refundsAndPaymentsEnabled: true,
    transactions: {},
    })
    const onClose = vi.fn()
    render(<TransactionModal isOpen onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } })
    fireEvent.blur(screen.getByPlaceholderText('0.00'))
    fireEvent.click(screen.getByLabelText('Split across categories'))

    const sliceAmounts = screen.getAllByLabelText('Slice amount')
    fireEvent.change(sliceAmounts[0], { target: { value: '150' } })
    fireEvent.blur(sliceAmounts[0])

    fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form') as HTMLFormElement)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Slices add up to more than the amount. Reduce a slice before saving.',
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  })

  it('still saves an ordinary positive split exactly as before', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Food', kind: 'expense' } },
      categories: {
        groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        household: { id: 'household', groupId: 'g1', name: 'Household', targetAmount: 0 },
      },
      refundsAndPaymentsEnabled: true,
    transactions: {},
    })
    render(<TransactionModal isOpen onClose={() => {}} />)

    setAmount('180')
    fireEvent.click(screen.getByLabelText('Split across categories'))
    fireEvent.click(screen.getByRole('button', { name: 'Add a slice' }))
    const sliceAmounts = screen.getAllByLabelText('Slice amount')
    fireEvent.change(sliceAmounts[0], { target: { value: '120' } })
    fireEvent.blur(sliceAmounts[0])

    fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form') as HTMLFormElement)

    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.amount).toBe(180)
    expect(saved.splits).toEqual([{ categoryId: 'groceries', amount: 120 }])
  })
})


describe('Refunds & Payments entry', () => {
  const amount = (value: string, label = 'Amount') => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.blur(screen.getByLabelText(label))
  }
  const save = () => fireEvent.submit(screen.getByRole('button', { name: /Add Transaction|Save Changes/ }).closest('form')!)
  const choose = (label: string, option: string) => {
    fireEvent.click(screen.getByRole('button', { name: label }))
    fireEvent.click(screen.getByRole('option', { name: option }))
  }
  beforeEach(() => { seed(); setMatchMedia(true) })

  it('saves a positive entry as a negative expense that reduces spending, without income categories', () => {
    useBudgetStore.setState({ transactions: { purchase: { id: 'purchase', type: 'expense', amount: 120, categoryId: 'groceries', date: '2026-10-01', description: '' } } })
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
    amount('40')
    expect(screen.getByText('Reduces Groceries spending by $40.00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Category' }))
    expect(screen.queryByRole('option', { name: 'Salary' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'Groceries' }))
    save()
    const saved = Object.values(useBudgetStore.getState().transactions).find(t => t.id !== 'purchase')!
    expect(saved).toMatchObject({ type: 'expense', amount: -40, categoryId: 'groceries' })
    expect(saved.shared).toBeUndefined()
    expect(saved.reimbursement).toBeUndefined()
    useBudgetStore.getState().updateTransaction(saved.id, { date: '2026-10-02' })
    expect(getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 9).spent).toBe(80)
  })

  it('keeps a saved offset editable with positive magnitude while disabled', () => {
    useBudgetStore.setState({ refundsAndPaymentsEnabled: false })
    const initial = { id: 'legacy', type: 'expense' as const, amount: -40, categoryId: 'groceries', date: '2026-09-02', description: 'Refund', tags: ['trip'], note: 'receipt' }
    useBudgetStore.getState().addTransaction(initial)
    render(<TransactionModal isOpen onClose={() => {}} initialTransaction={initial} />)
    expect(screen.getByLabelText('Amount')).toHaveValue('40')
    expect(screen.getByRole('button', { name: 'Refunds & Payments' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Refunds & Payments is off for new transactions. This saved payment still counts.')).toBeInTheDocument()
    amount('50'); save()
    expect(useBudgetStore.getState().transactions.legacy).toMatchObject({ ...initial, amount: -50 })
  })

  it.each([undefined, { id: 'income', type: 'income' as const, amount: 40, categoryId: 'salary', date: '2026-10-01', description: '' }])('hides offset choice when disabled for new and income entries', initial => {
    useBudgetStore.setState({ refundsAndPaymentsEnabled: false })
    render(<TransactionModal isOpen onClose={() => {}} initialTransaction={initial} />)
    expect(screen.queryByRole('button', { name: 'Refunds & Payments' })).not.toBeInTheDocument()
  })

  it.each(['0', '-40', '0.001', '9'.repeat(310)])('rejects invalid positive magnitude %s', value => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    amount(value); save()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero.')
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
    if (value.startsWith('-')) expect(screen.getByText('Use Refunds & Payments for money received.')).toBeInTheDocument()
  })

  it('requires a valid category, including when a category is removed while the form is open', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    amount('40'); choose('Category', 'Uncategorized'); save()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid category before saving.')
    choose('Category', 'Groceries')
    useBudgetStore.setState({ categoryGroups: {} }); save()
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  })

  it.each([false, true])('encodes signed split magnitudes with remainder %s', remainder => {
    useBudgetStore.setState({ categories: { ...useBudgetStore.getState().categories, dining: { id: 'dining', groupId: 'ge', name: 'Dining', targetAmount: 0 } } })
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
    amount('100'); fireEvent.click(screen.getByLabelText('Split across categories'))
    amount('60', 'Slice amount')
    if (!remainder) {
      fireEvent.click(screen.getByRole('button', { name: 'Add a slice' }))
      const fields = screen.getAllByLabelText('Slice amount')
      fireEvent.change(fields[1], { target: { value: '40' } }); fireEvent.blur(fields[1])
      fireEvent.click(screen.getAllByRole('button', { name: 'Slice category' })[1])
      fireEvent.click(screen.getByRole('option', { name: 'Dining' }))
    }
    expect(screen.getAllByText('Reduces Groceries spending by '+(remainder ? '$100.00' : '$60.00'))).toHaveLength(1)
    save()
    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.amount).toBe(-100)
    expect(saved.splits).toEqual(remainder ? [{ categoryId: 'groceries', amount: -60 }] : [{ categoryId: 'groceries', amount: -60 }, { categoryId: 'dining', amount: -40 }])
  })

  it.each(['150', '-1', '0.001'])('rejects invalid offset allocation %s', value => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
    amount('100'); fireEvent.click(screen.getByLabelText('Split across categories')); amount(value, 'Slice amount'); save()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  })

  it('saves cent allocations and rejects incompatible income slices after conversion', () => {
    const initial = { id: 'pay', type: 'income' as const, amount: 0.01, categoryId: 'salary', date: '2026-10-01', description: '', splits: [{ categoryId: 'salary', amount: 0.01 }] }
    useBudgetStore.getState().addTransaction(initial)
    render(<TransactionModal isOpen onClose={() => {}} initialTransaction={initial} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' })); save()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid category for every allocation.')
    choose('Slice category', 'Groceries'); save()
    expect(useBudgetStore.getState().transactions.pay).toMatchObject({ type: 'expense', amount: -0.01, splits: [{ categoryId: 'groceries', amount: -0.01 }] })
  })

  it('requires explicit shared settlement acknowledgment and preserves the same ID', () => {
    const initial = { id: 'pay', type: 'income' as const, amount: 40, categoryId: 'salary', date: '2026-10-01', description: '', reimbursement: { from: 'Alex' } }
    useBudgetStore.getState().addTransaction(initial)
    render(<TransactionModal isOpen onClose={() => {}} initialTransaction={initial} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' })); save()
    expect(useBudgetStore.getState().transactions.pay).toEqual(initial)
    expect(screen.getByLabelText('Use this payment to reduce expenses instead of settling the shared bill.')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText('Use this payment to reduce expenses instead of settling the shared bill.')); save()
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(1)
    expect(useBudgetStore.getState().transactions.pay).toMatchObject({ type: 'expense', amount: -40, categoryId: 'groceries' })
    expect(useBudgetStore.getState().transactions.pay.reimbursement).toBeUndefined()
  })

  it('requires turning off Shared bill before selecting offset mode', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('Shared bill'))
    fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
    expect(screen.getByRole('button', { name: 'Expense' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Turn off Shared bill before using Refunds & Payments. This will discard the shared bill IOU treatment.')
    fireEvent.click(screen.getByLabelText('Shared bill')); fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
    expect(screen.queryByLabelText('Shared bill')).not.toBeInTheDocument()
  })
})


it.each(['-', ''])('does not save a stale amount after editing the input to %s', text => {
  seed()
  render(<TransactionModal isOpen onClose={() => {}} />)
  const input = screen.getByLabelText('Amount')
  fireEvent.change(input, { target: { value: '40' } })
  fireEvent.change(input, { target: { value: text } })
  if (text === '-') expect(screen.getByText('Use Refunds & Payments for money received.')).toBeInTheDocument()
  fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form')!)
  expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero.')
})

it('cancels shared settlement conversion without changing the saved transaction', () => {
  seed()
  const initial = { id: 'settlement', type: 'income' as const, amount: 40, date: '2026-10-02', categoryId: 'salary', description: 'Alex', reimbursement: { from: 'Alex' } }
  useBudgetStore.getState().addTransaction(initial)
  const close = vi.fn()
  render(<TransactionModal isOpen onClose={close} initialTransaction={initial} />)
  fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
  expect(screen.getByText('This payment currently settles a shared bill. Using it to reduce expenses will stop settling that balance. Shared bills already count only your share, so this can reduce spending again.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Close$/ }))
  expect(close).toHaveBeenCalled()
  expect(useBudgetStore.getState().transactions.settlement).toEqual(initial)
})


it('does not turn malformed saved negative income into a positive payment on open', () => {
  seed()
  const initial = { id: 'invalid', type: 'income' as const, amount: -40, date: '2026-10-02', categoryId: 'salary', description: '' }
  useBudgetStore.getState().addTransaction(initial)
  render(<TransactionModal isOpen onClose={() => {}} initialTransaction={initial} />)
  fireEvent.submit(screen.getByRole('button', { name: 'Save Changes' }).closest('form')!)
  expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero.')
  expect(useBudgetStore.getState().transactions.invalid.amount).toBe(-40)
})

it('preserves an ordinary income split and converts its cash direction exclusively', () => {
  seed()
  const initial = { id: 'income', type: 'income' as const, amount: 100, date: '2026-10-02', categoryId: 'salary', description: '', splits: [{ categoryId: 'salary', amount: 60 }] }
  useBudgetStore.getState().addTransaction(initial)
  const view = render(<TransactionModal isOpen onClose={() => {}} initialTransaction={initial} />)
  fireEvent.submit(screen.getByRole('button', { name: 'Save Changes' }).closest('form')!)
  expect(useBudgetStore.getState().transactions.income).toEqual(initial)
  view.unmount()
  render(<TransactionModal isOpen onClose={() => {}} initialTransaction={{ ...initial, splits: undefined }} />)
  const before = getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 9)
  fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
  fireEvent.submit(screen.getByRole('button', { name: 'Save Changes' }).closest('form')!)
  const after = getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 9)
  expect(after.spent).toBe(before.spent - 100)
  expect(after.remaining + after.unallocated).toBe(before.remaining + before.unallocated)
  expect(useBudgetStore.getState().transactions.income).toMatchObject({ id: 'income', type: 'expense', amount: -100, categoryId: 'groceries', date: initial.date })
})

it.each(['parent', 'slice'])('rejects finite 1e308 %s values before cent rounding can save Infinity', field => {
  seed()
  render(<TransactionModal isOpen onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: field === 'parent' ? '1' + '0'.repeat(308) : '100' } })
  if (field === 'slice') {
    fireEvent.click(screen.getByLabelText('Split across categories'))
    fireEvent.change(screen.getByLabelText('Slice amount'), { target: { value: '1' + '0'.repeat(308) } })
  }
  fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form')!)
  expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero')
})

it.each(['parent', 'slice'])('rejects unsafe cent integers for %s values', field => {
  seed()
  render(<TransactionModal isOpen onClose={() => {}} />)
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: field === 'parent' ? '100000000000000' : '100' } })
  if (field === 'slice') {
    fireEvent.click(screen.getByLabelText('Split across categories'))
    fireEvent.change(screen.getByLabelText('Slice amount'), { target: { value: '100000000000000' } })
  }
  fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form')!)
  expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero')
})

it('combines rounded split reductions and the parent remainder by category in the preview', () => {
  seed()
  useBudgetStore.setState({ categories: { ...useBudgetStore.getState().categories, dining: { id: 'dining', groupId: 'ge', name: 'Dining', targetAmount: 0 } } })
  render(<TransactionModal isOpen onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1.004' } })
  fireEvent.click(screen.getByLabelText('Split across categories'))
  fireEvent.click(screen.getByRole('button', { name: 'Add a slice' }))
  const amounts = screen.getAllByLabelText('Slice amount')
  amounts.forEach(input => fireEvent.change(input, { target: { value: '0.335' } }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Slice category' })[1])
  fireEvent.click(screen.getByRole('option', { name: 'Dining' }))
  expect(screen.getAllByText('Reduces Groceries spending by $0.66')).toHaveLength(1)
  expect(screen.getByText('Reduces Dining spending by $0.34')).toBeInTheDocument()
  expect(screen.queryByText('Reduces Groceries spending by $0.32')).not.toBeInTheDocument()
  expect(screen.getByText(/\$0.32 left to allocate/)).toBeInTheDocument()
  fireEvent.submit(screen.getByRole('button', { name: 'Add Transaction' }).closest('form')!)
  const saved = Object.values(useBudgetStore.getState().transactions)[0]
  expect(saved).toMatchObject({ amount: -1, splits: [{ categoryId: 'groceries', amount: -0.34 }, { categoryId: 'dining', amount: -0.34 }] })
  expect(splitParts(saved)).toEqual([{ categoryId: 'groceries', amount: -0.34 }, { categoryId: 'dining', amount: -0.34 }, { categoryId: 'groceries', amount: -0.32 }])
})
