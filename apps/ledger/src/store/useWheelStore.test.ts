import { useWheelStore } from './useWheelStore'

const initialState = useWheelStore.getState()

beforeEach(() => {
  useWheelStore.setState(initialState, true)
})

describe('useWheelStore', () => {
  it('starts with no rows and no files', () => {
    expect(useWheelStore.getState().rawRows).toEqual([])
    expect(useWheelStore.getState().fileCount).toBe(0)
  })

  it('counts each imported file', () => {
    useWheelStore.getState().addRows([], 1)
    useWheelStore.getState().addRows([], 2)
    expect(useWheelStore.getState().fileCount).toBe(3)
  })

  it('clears rows and the file count together', () => {
    useWheelStore.getState().addRows([], 1)
    useWheelStore.getState().clearAll()
    expect(useWheelStore.getState().rawRows).toEqual([])
    expect(useWheelStore.getState().fileCount).toBe(0)
  })
})
