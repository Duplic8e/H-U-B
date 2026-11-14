import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'

/** The palette actually painted: the value of `data-theme` on <html>. */
export type AppTheme = 'light' | 'dark'

/** What the user picked. 'system' follows the device's Light/Dark setting,
 *  the way iOS apps do. */
export type ThemePreference = 'system' | AppTheme

export const THEME_PREFERENCES: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** Themes whose --bg-primary is light. App.tsx drives Tailwind's `dark`
 *  class off this set. */
export const LIGHT_THEMES: ReadonlySet<AppTheme> = new Set<AppTheme>(['light'])

// Mirrors each theme's --bg-primary in src/index.css. jsdom's
// getComputedStyle does not resolve CSS custom properties from stylesheets,
// so the theme-color meta sync in App.tsx reads this record instead.
export const THEME_BACKGROUNDS: Record<AppTheme, string> = {
  light: '#f2f2f7',
  dark: '#000000',
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemTheme(): AppTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function resolve(preference: ThemePreference): AppTheme {
  return preference === 'system' ? systemTheme() : preference
}

interface ThemeState {
  preference: ThemePreference
  /** Resolved from `preference` and, for 'system', the device setting. */
  theme: AppTheme
  setPreference: (preference: ThemePreference) => void
  /** Pins an explicit theme. Kept for callers that only know light or dark. */
  setTheme: (theme: AppTheme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      theme: resolve('system'),
      setPreference: (preference) => set({ preference, theme: resolve(preference) }),
      setTheme: (theme) => set({ preference: theme, theme }),
    }),
    {
      name: STORAGE_KEYS.theme,
      version: 2,
      // Only the choice is stored. The resolved theme depends on the device
      // and is recomputed on load.
      partialize: (state) => ({ preference: state.preference }),
      // v0/v1 stored one of six named themes ({ theme: 'luxury' }). Those
      // were replaced by the iOS-style Light and Dark pair, and every old
      // choice moves to following the device, which is what iOS apps do.
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) return { preference: 'system' }
        return persisted as { preference: ThemePreference }
      },
      merge: (persisted, current) => {
        const raw = (persisted as { preference?: unknown } | undefined)?.preference
        const preference: ThemePreference = raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
        return { ...current, preference, theme: resolve(preference) }
      },
    }
  )
)

// Follow the device when it switches between Light and Dark (including the
// automatic sunset switch) while the app is open.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const media = window.matchMedia(DARK_QUERY)
  const onChange = () => {
    const { preference } = useThemeStore.getState()
    if (preference === 'system') useThemeStore.setState({ theme: systemTheme() })
  }
  if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange)
}
