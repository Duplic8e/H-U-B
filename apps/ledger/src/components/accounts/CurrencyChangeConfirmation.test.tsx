import { fireEvent, render, screen } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { CurrencyChangeConfirmation } from './CurrencyChangeConfirmation'

it('states the unchanged balance and new currency with separate confirm and cancel actions', () => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(<CurrencyChangeConfirmation changes={[{ id: 'a', name: 'Savings', value: 1000.125, from: 'CAD', to: 'USD' }]} onConfirm={onConfirm} onCancel={onCancel} />)
  expect(screen.getByText(/balance will remain 1,000.125 and change from CAD to USD/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }))
  expect(onCancel).toHaveBeenCalledOnce()
  expect(onConfirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Currency Change' }))
  expect(onConfirm).toHaveBeenCalledOnce()
})
