import { fireEvent, render, screen } from '@testing-library/react'
import { TransactionModal } from './TransactionModal'
import { installMatchMedia } from '../../test-utils/matchMedia'

beforeEach(() => { installMatchMedia() })

describe('TransactionModal error identification', () => {
  it('explains why an empty submit did nothing, and marks the field invalid', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter an amount greater than zero.')
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears the error once a valid amount is entered', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    const amount = screen.getByLabelText('Amount')
    fireEvent.focus(amount)
    fireEvent.change(amount, { target: { value: '12.50' } })
    fireEvent.blur(amount)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(amount).toHaveAttribute('aria-invalid', 'false')
  })
})
