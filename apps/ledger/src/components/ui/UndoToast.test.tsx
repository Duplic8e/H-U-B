import { render, screen, fireEvent } from '@testing-library/react'
import { UndoToast } from './UndoToast'
import { useUndoStore } from '../../store/useUndoStore'

const initialState = useUndoStore.getState()

beforeEach(() => {
  useUndoStore.setState(initialState, true)
})

describe('UndoToast', () => {
  it('renders nothing when there is no pending action', () => {
    const { container } = render(<UndoToast />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the label and runs the action on Undo', () => {
    let restored = false
    useUndoStore.getState().offerUndo('Deleted 3 transactions', () => { restored = true })
    render(<UndoToast />)
    expect(screen.getByText('Deleted 3 transactions')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(restored).toBe(true)
    expect(useUndoStore.getState().pending).toBeNull()
  })

  it('dismisses without running the action', () => {
    let restored = false
    useUndoStore.getState().offerUndo('Deleted', () => { restored = true })
    render(<UndoToast />)
    fireEvent.click(screen.getByLabelText('Dismiss undo'))
    expect(restored).toBe(false)
    expect(useUndoStore.getState().pending).toBeNull()
  })

  it('sits above the tab bar including the home indicator', () => {
    useUndoStore.getState().offerUndo('Deleted account', () => {})
    const { container } = render(<UndoToast />)
    const toast = container.querySelector('[role="status"]')!
    // The bar is 52px plus env(safe-area-inset-bottom), which is 34px on a
    // home-indicator iPhone. A fixed 96px cleared it by only 10px, and the
    // update toast's fixed 64px did not clear it at all.
    // --safe-bottom is env(safe-area-inset-bottom), defined once in index.css.
    expect(toast.className).toMatch(/var\(--safe-bottom\)/)
  })
})
