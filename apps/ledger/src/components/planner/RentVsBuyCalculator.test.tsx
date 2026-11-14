import { render, screen } from '@testing-library/react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { RentVsBuyCalculator } from './RentVsBuyCalculator'

const initialState = usePlannerStore.getState()

beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initialState, true)
})

describe('RentVsBuyCalculator chart card', () => {
  it('keeps the caption inside the chart card and drops the fixed card height', () => {
    render(<RentVsBuyCalculator />)
    const caption = screen.getByText(/Cumulative unrecoverable costs only/)
    const card = caption.closest('.themed-card')
    expect(card).not.toBeNull()
    expect(card).toContainElement(caption)
    expect(card).not.toHaveClass('h-[320px]')
  })
})
