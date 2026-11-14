import { useCompensationStore } from './useCompensationStore'

const initialState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialState, true)
})

describe('useCompensationStore CAD conversion toggle', () => {
  it('defaults useCadConversion to false', () => {
    expect(useCompensationStore.getState().useCadConversion).toBe(false)
  })

  it('toggleCadConversion flips the flag', () => {
    useCompensationStore.getState().toggleCadConversion()
    expect(useCompensationStore.getState().useCadConversion).toBe(true)
    useCompensationStore.getState().toggleCadConversion()
    expect(useCompensationStore.getState().useCadConversion).toBe(false)
  })

  it('persists to the existing ledger-compensation LocalStorage key', () => {
    useCompensationStore.getState().toggleCadConversion()
    const raw = localStorage.getItem('ledger-compensation')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).state.useCadConversion).toBe(true)
  })
})
