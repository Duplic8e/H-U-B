import { lazy, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useThemeStore, THEME_BACKGROUNDS, LIGHT_THEMES } from './store/useThemeStore'
import { AccountCurrencyCoordinator } from './components/accounts/AccountCurrencyCoordinator'
import { Layout } from './components/Layout'

// Dashboard is the index route, so it stays in the entry chunk: lazy-loading it
// would only add a round trip before first paint. Every other page is a
// separate chunk, fetched when the user first navigates to it.
import { Dashboard } from './pages/Dashboard'

const Budgeting = lazy(() => import('./pages/Budgeting').then((m) => ({ default: m.Budgeting })))
const Investments = lazy(() => import('./pages/Investments').then((m) => ({ default: m.Investments })))
const Planner = lazy(() => import('./pages/Planner').then((m) => ({ default: m.Planner })))
const PlannerTool = lazy(() => import('./pages/PlannerTool').then((m) => ({ default: m.PlannerTool })))
const Compensation = lazy(() => import('./pages/Compensation').then((m) => ({ default: m.Compensation })))
const Categorize = lazy(() => import('./pages/Categorize').then((m) => ({ default: m.Categorize })))

function App() {
  const { theme } = useThemeStore()

  // Apply theme to html root element for Tailwind dark mode and global CSS variables
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    
    if (LIGHT_THEMES.has(theme)) {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }

    // The manifest can only carry one theme_color, and it was hardcoded
    // black while the app ships a light theme, so an installed light-theme
    // app got black system bars. The meta tag wins over the manifest at
    // runtime, so keep it in step with whichever theme is active.
    //
    // jsdom's getComputedStyle does not resolve custom properties set by a
    // stylesheet (it always returns ''), so reading --bg-primary directly
    // would silently no-op under test. Read from the THEME_BACKGROUNDS
    // record instead, which mirrors src/index.css and works identically in
    // both jsdom and a real browser.
    const bg = THEME_BACKGROUNDS[theme]
    if (bg) {
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'theme-color'
        document.head.appendChild(meta)
      }
      meta.content = bg
    }
  }, [theme])

  return (
    <HashRouter>
      <AccountCurrencyCoordinator />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="budget" element={<Budgeting />} />
          <Route path="budget/categorize" element={<Categorize />} />
          <Route path="investments" element={<Investments />} />
          <Route path="planner" element={<Planner />} />
          <Route path="planner/income-tax" element={<Navigate to="/planner/salary-tax" replace />} />
          <Route path="planner/take-home-pay" element={<Navigate to="/planner/salary-tax" replace />} />
          <Route path="planner/:toolId" element={<PlannerTool />} />
          <Route path="projections" element={<Navigate to="/planner" replace />} />
          <Route path="compensation" element={<Compensation />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
