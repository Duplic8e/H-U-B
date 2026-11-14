import { render, screen, fireEvent } from '@testing-library/react'
import { CompareView } from './CompareView'
import { useCompensationStore } from '../../store/useCompensationStore'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
})

// Numeric fields in this form have a visible <label> that is not
// programmatically associated (no htmlFor/aria-label), so getByLabelText
// can't find them. Locate the label by its text, then grab the input that
// follows it within the same field wrapper.
function inputAfterLabel(text: string | RegExp): HTMLInputElement {
  const label = screen.getByText(text)
  const input = label.parentElement?.querySelector('input')
  if (!input) throw new Error(`No input found after label matching ${text}`)
  return input as HTMLInputElement
}

describe('CompareView numeric field submission (NumberInput conversion)', () => {
  it('computes total compensation delta from the entered base salary', () => {
    useCompensationStore.getState().setPrimaryPackage({ baseSalary: 100000, companyCurrentPrice: 100 })

    render(<CompareView />)

    const baseSalaryInput = inputAfterLabel(/^base salary/i)
    fireEvent.change(baseSalaryInput, { target: { value: '130000' } })

    fireEvent.click(screen.getByRole('button', { name: /calculate comparison/i }))

    expect(useCompensationStore.getState().comparePackage?.baseSalary).toBe(130000)

    // Delta row(s) show the compare offer paying more given a higher base salary
    // (the base salary row and, since nothing else changed, the total comp row).
    expect(screen.getAllByText(/\$30,000 more/i).length).toBeGreaterThan(0)
  })
})
