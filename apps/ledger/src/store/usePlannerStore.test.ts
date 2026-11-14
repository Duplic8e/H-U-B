import { usePlannerStore } from './usePlannerStore'

const initialState = usePlannerStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initialState, true)
})

describe('usePlannerStore', () => {
  it('setInput stores a value namespaced by tool id', () => {
    usePlannerStore.getState().setInput('compound-interest', 'principal', 5000)
    expect(usePlannerStore.getState().inputs['compound-interest'].principal).toBe(5000)
  })

  it('setInput preserves sibling fields and other tools', () => {
    const { setInput } = usePlannerStore.getState()
    setInput('compound-interest', 'principal', 5000)
    setInput('compound-interest', 'years', 10)
    setInput('savings-goal', 'target', 100000)
    const { inputs } = usePlannerStore.getState()
    expect(inputs['compound-interest']).toEqual({ principal: 5000, years: 10 })
    expect(inputs['savings-goal']).toEqual({ target: 100000 })
  })

  it('resetTool clears only that tool', () => {
    const { setInput, resetTool } = usePlannerStore.getState()
    setInput('compound-interest', 'principal', 5000)
    setInput('savings-goal', 'target', 100000)
    resetTool('compound-interest')
    const { inputs } = usePlannerStore.getState()
    expect(inputs['compound-interest']).toBeUndefined()
    expect(inputs['savings-goal']).toEqual({ target: 100000 })
  })

  it('persists under the ledger-planner key', () => {
    usePlannerStore.getState().setInput('compound-interest', 'principal', 5000)
    expect(localStorage.getItem('ledger-planner')).toContain('"principal":5000')
  })
})
