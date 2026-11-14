import { describe, expect, it } from 'vitest'
import { fireEvent, render, within } from '@testing-library/react'
import { DebtPayoffCalculator } from './DebtPayoffCalculator'

describe('DebtPayoffCalculator debt card', () => {
  it('renders a mobile header row containing the remove button before the fields', () => {
    const { getAllByTestId } = render(<DebtPayoffCalculator />)
    const header = getAllByTestId('debt-card-header')[0]
    expect(within(header).getByLabelText(/Remove/)).toBeInTheDocument()
  })

  it('removes the correct debt when there are multiple debts', () => {
    const { getAllByTestId, queryAllByTestId } = render(<DebtPayoffCalculator />)
    const headersBefore = getAllByTestId('debt-card-header')
    expect(headersBefore.length).toBeGreaterThan(1)
    const secondHeaderName = within(headersBefore[1]).getByText(/.+/).textContent

    const removeButton = within(headersBefore[0]).getByLabelText(/Remove/)
    fireEvent.click(removeButton)

    const headersAfter = queryAllByTestId('debt-card-header')
    expect(headersAfter.length).toBe(headersBefore.length - 1)
    // The remaining first debt should be the one that was previously second.
    expect(within(headersAfter[0]).getByText(/.+/).textContent).toBe(secondHeaderName)
  })
})
