import { render, screen } from '@testing-library/react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { RaiseInflationCalculator } from './RaiseInflationCalculator'

const TOOL_ID = 'raise-inflation'
const initialState = usePlannerStore.getState()

beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initialState, true)
})

function seed(oldSalary: number, newSalary: number, inflationPct: number) {
  usePlannerStore.getState().setInput(TOOL_ID, 'oldSalary', oldSalary)
  usePlannerStore.getState().setInput(TOOL_ID, 'newSalary', newSalary)
  usePlannerStore.getState().setInput(TOOL_ID, 'inflationPct', inflationPct)
}

describe('RaiseInflationCalculator verdict banner', () => {
  it('renders a real-raise banner in the accent tone', () => {
    seed(90000, 96500, 3)
    render(<RaiseInflationCalculator />)
    const status = screen.getByRole('status')
    expect(status).toHaveClass('border-accent/50', 'bg-accent/10')
    expect(status).toHaveTextContent(/A real raise/)
  })

  it('renders a not-a-real-raise banner in the error tone', () => {
    seed(90000, 91000, 5)
    render(<RaiseInflationCalculator />)
    const status = screen.getByRole('status')
    expect(status).toHaveClass('border-error/50', 'bg-error/10')
    expect(status).toHaveTextContent(/Not a real raise/)
  })

  it('renders a wash banner in the neutral tone', () => {
    seed(90000, 92700, 3)
    render(<RaiseInflationCalculator />)
    const status = screen.getByRole('status')
    expect(status).toHaveClass('border-border', 'bg-bg-primary/40')
    expect(status).toHaveTextContent(/A wash/)
  })
})
