import { useRecurringStore } from './useRecurringStore'

const initialState = useRecurringStore.getState()

beforeEach(() => {
  useRecurringStore.setState(initialState, true)
})

describe('useRecurringStore', () => {
  it('starts with nothing ignored', () => {
    expect(useRecurringStore.getState().ignoredKeys).toEqual([])
  })

  it('remembers an ignored charge', () => {
    useRecurringStore.getState().ignore('expense:NETFLIX')
    expect(useRecurringStore.getState().ignoredKeys).toEqual(['expense:NETFLIX'])
  })

  it('does not record the same charge twice', () => {
    useRecurringStore.getState().ignore('expense:NETFLIX')
    useRecurringStore.getState().ignore('expense:NETFLIX')
    expect(useRecurringStore.getState().ignoredKeys).toEqual(['expense:NETFLIX'])
  })

  it('restores an ignored charge', () => {
    useRecurringStore.getState().ignore('expense:NETFLIX')
    useRecurringStore.getState().ignore('expense:SPOTIFY')
    useRecurringStore.getState().unignore('expense:NETFLIX')
    expect(useRecurringStore.getState().ignoredKeys).toEqual(['expense:SPOTIFY'])
  })
})
