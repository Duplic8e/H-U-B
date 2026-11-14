import { useDashboardLayoutStore } from './useDashboardLayoutStore'

const initialState = useDashboardLayoutStore.getState()
beforeEach(() => {
  localStorage.clear()
  useDashboardLayoutStore.setState(initialState, true)
})

describe('useDashboardLayoutStore', () => {
  it('moveWidget places a widget before another', () => {
    useDashboardLayoutStore.getState().setOrder(['a', 'b', 'c'])
    useDashboardLayoutStore.getState().moveWidget('c', 'a')
    expect(useDashboardLayoutStore.getState().order).toEqual(['c', 'a', 'b'])
  })

  it('moveWidget with beforeId null moves to the end', () => {
    useDashboardLayoutStore.getState().setOrder(['a', 'b', 'c'])
    useDashboardLayoutStore.getState().moveWidget('a', null)
    expect(useDashboardLayoutStore.getState().order).toEqual(['b', 'c', 'a'])
  })

  it('persists under ledger-dashboard-layout', () => {
    useDashboardLayoutStore.getState().setOrder(['x'])
    expect(localStorage.getItem('ledger-dashboard-layout')).toContain('"x"')
  })
})

describe('hidden widgets', () => {
  it('starts with nothing hidden', () => {
    expect(useDashboardLayoutStore.getState().hidden).toEqual([])
  })

  it('toggles a widget in and out of the hidden list', () => {
    useDashboardLayoutStore.getState().toggleHidden('portfolio')
    expect(useDashboardLayoutStore.getState().hidden).toEqual(['portfolio'])
    useDashboardLayoutStore.getState().toggleHidden('portfolio')
    expect(useDashboardLayoutStore.getState().hidden).toEqual([])
  })
})

describe('moveBy', () => {
  it('moves a widget one place earlier, materialising the default order first', () => {
    useDashboardLayoutStore.getState().moveBy('b', -1, ['a', 'b', 'c'])
    expect(useDashboardLayoutStore.getState().order).toEqual(['b', 'a', 'c'])
  })

  it('moves a widget one place later', () => {
    useDashboardLayoutStore.getState().moveBy('a', 1, ['a', 'b', 'c'])
    expect(useDashboardLayoutStore.getState().order).toEqual(['b', 'a', 'c'])
  })

  it('is a no-op at the ends', () => {
    useDashboardLayoutStore.getState().moveBy('a', -1, ['a', 'b', 'c'])
    expect(useDashboardLayoutStore.getState().order).toEqual(['a', 'b', 'c'])
    useDashboardLayoutStore.getState().moveBy('c', 1, ['a', 'b', 'c'])
    expect(useDashboardLayoutStore.getState().order).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op for an id that is not in the given order', () => {
    useDashboardLayoutStore.getState().moveBy('zz', 1, ['a', 'b', 'c'])
    expect(useDashboardLayoutStore.getState().order).toEqual(['a', 'b', 'c'])
  })
})
