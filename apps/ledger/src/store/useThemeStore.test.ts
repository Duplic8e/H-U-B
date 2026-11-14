import { useThemeStore } from './useThemeStore'

const initialState = useThemeStore.getState()

beforeEach(() => {
  useThemeStore.setState(initialState, true)
  localStorage.clear()
})

describe('useThemeStore', () => {
  it('follows the device by default', () => {
    expect(useThemeStore.getState().preference).toBe('system')
    // jsdom has no prefers-color-scheme support, so System resolves to light.
    expect(['light', 'dark']).toContain(useThemeStore.getState().theme)
  })

  it('pins Light or Dark', () => {
    useThemeStore.getState().setPreference('dark')
    expect(useThemeStore.getState()).toMatchObject({ preference: 'dark', theme: 'dark' })
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState()).toMatchObject({ preference: 'light', theme: 'light' })
  })

  it('stores only the choice, never the resolved theme', () => {
    useThemeStore.getState().setPreference('dark')
    const saved = JSON.parse(localStorage.getItem('financial-dashboard-theme')!)
    expect(saved).toEqual({ state: { preference: 'dark' }, version: 2 })
  })

  it('moves every old named theme to following the device', async () => {
    for (const old of ['geometric', 'tactical', 'luxury', 'aurora', 'glass', 'nouveau']) {
      localStorage.setItem('financial-dashboard-theme', JSON.stringify({ state: { theme: old }, version: 1 }))
      await useThemeStore.persist.rehydrate()
      expect(useThemeStore.getState().preference).toBe('system')
      expect(['light', 'dark']).toContain(useThemeStore.getState().theme)
    }
  })
})
