import { useUndoStore } from './useUndoStore'

const initialState = useUndoStore.getState()

beforeEach(() => {
  useUndoStore.setState(initialState, true)
})

describe('useUndoStore', () => {
  it('holds the most recent offer', () => {
    useUndoStore.getState().offerUndo('Deleted "Coffee"', () => {})
    expect(useUndoStore.getState().pending?.label).toBe('Deleted "Coffee"')
  })

  it('replaces an earlier offer rather than queueing it', () => {
    useUndoStore.getState().offerUndo('first', () => {})
    useUndoStore.getState().offerUndo('second', () => {})
    expect(useUndoStore.getState().pending?.label).toBe('second')
  })

  it('runs the action once and clears the offer', () => {
    let calls = 0
    useUndoStore.getState().offerUndo('x', () => { calls += 1 })
    useUndoStore.getState().runUndo()
    useUndoStore.getState().runUndo()
    expect(calls).toBe(1)
    expect(useUndoStore.getState().pending).toBeNull()
  })

  it('drops the offer on dismiss without running it', () => {
    let calls = 0
    useUndoStore.getState().offerUndo('x', () => { calls += 1 })
    useUndoStore.getState().dismissUndo()
    expect(calls).toBe(0)
    expect(useUndoStore.getState().pending).toBeNull()
  })
})
