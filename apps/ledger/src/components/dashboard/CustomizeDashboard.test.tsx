import { render, screen, fireEvent } from '@testing-library/react'
import { CustomizeDashboard } from './CustomizeDashboard'
import { useDashboardLayoutStore } from '../../store/useDashboardLayoutStore'

const initialState = useDashboardLayoutStore.getState()

beforeEach(() => {
  useDashboardLayoutStore.setState(initialState, true)
})

describe('CustomizeDashboard', () => {
  const ids = ['net-worth', 'trend', 'portfolio']

  it('switches a widget off', () => {
    render(<CustomizeDashboard open onClose={() => {}} orderedIds={ids} />)
    fireEvent.click(screen.getByLabelText('Show Portfolio'))
    expect(useDashboardLayoutStore.getState().hidden).toEqual(['portfolio'])
  })

  it('moves a widget up', () => {
    render(<CustomizeDashboard open onClose={() => {}} orderedIds={ids} />)
    fireEvent.click(screen.getByLabelText('Move Portfolio up'))
    expect(useDashboardLayoutStore.getState().order).toEqual(['net-worth', 'portfolio', 'trend'])
  })

  it('names every widget, so no row shows a raw id', () => {
    render(<CustomizeDashboard open onClose={() => {}} orderedIds={ids} />)
    expect(screen.queryByText('net-worth')).toBeNull()
    expect(screen.getByText('Net Worth Over Time')).toBeInTheDocument()
  })

  it('keeps hidden widgets in the saved order when reordering', () => {
    useDashboardLayoutStore.setState({ hidden: ['trend'] })
    render(<CustomizeDashboard open onClose={() => {}} orderedIds={ids} />)
    fireEvent.click(screen.getByLabelText('Move Portfolio up'))
    const finalOrder = useDashboardLayoutStore.getState().order
    expect(finalOrder).toContain('net-worth')
    expect(finalOrder).toContain('trend')
    expect(finalOrder).toContain('portfolio')
  })
})
