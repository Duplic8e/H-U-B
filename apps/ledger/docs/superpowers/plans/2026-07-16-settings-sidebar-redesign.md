# Settings + Sidebar Redesign (v0.6.1-beta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Settings sheet into grouped section cards with mini-app-preview theme tiles, refine the desktop sidebar (search affordance, active accent bar, tidy dock), and ship as 0.6.1-beta.

**Architecture:** Pure presentational restructuring of four existing components (`SettingsSheet`, `ThemeSwatchGrid`, `MarketDataSettings`, `BackupControls`) plus the desktop `<nav>` in `Layout.tsx`. No store, routing, or data changes. One new exported component (`MarketDataStatusBadge`) so the sheet can put key status in a card header.

**Tech Stack:** React 19 + TypeScript, Tailwind v4 theme tokens (`text-accent`, `border-border`, `bg-bg-primary`, etc.), lucide-react icons, zustand stores, Vitest + Testing Library (jsdom).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-settings-sidebar-redesign-design.md`
- Version string everywhere: `0.6.1-beta` (pre-1.0 releases always carry `-beta`).
- No em dashes in any user-facing copy (project convention since v0.5).
- There is **no** `success` color token; use `accent` for the "Key active" badge.
- Theme colors in swatches are hardcoded hexes mirroring `index.css` — keep that pattern.
- Mobile bottom tab bar in `Layout.tsx` must NOT change.
- Run tests with `npx vitest run <path>` (config already excludes `.claude/worktrees/**`). Full suite: `npx vitest run`.
- Lint baseline: main has 31 pre-existing eslint errors; "clean" means zero NEW errors (`npx eslint src/components/settings src/components/theme src/components/Layout.tsx`).
- Commit after every task; message prefixes as given per task, each ending with the Claude co-author trailer.

---

### Task 1: Theme picker mini app-preview tiles

**Files:**
- Modify: `src/components/theme/ThemeSwatchGrid.tsx` (whole file replaced)
- Test: `src/components/theme/ThemeSwatchGrid.test.tsx`

**Interfaces:**
- Consumes: `useThemeStore` (unchanged: `{ theme: AppTheme, setTheme(t) }`).
- Produces: `ThemeSwatchGrid` component, same export name and props (none). Task 4 renders it unchanged.

- [ ] **Step 1: Add failing test for preview content**

Append to the existing `describe` block in `src/components/theme/ThemeSwatchGrid.test.tsx`:

```tsx
  it('renders a sparkline preview in every tile', () => {
    const { container } = render(<ThemeSwatchGrid />)
    expect(container.querySelectorAll('svg polyline')).toHaveLength(5)
  })
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run src/components/theme/ThemeSwatchGrid.test.tsx`
Expected: 2 pass, 1 FAIL (`expected 0 to be 5`).

- [ ] **Step 3: Replace ThemeSwatchGrid implementation**

Replace the entire contents of `src/components/theme/ThemeSwatchGrid.tsx` with:

```tsx
import React from 'react'
import { Check } from 'lucide-react'
import { useThemeStore, type AppTheme } from '../../store/useThemeStore'

// Swatch colors mirror each theme's --bg-primary / --accent in index.css.
// headerBg is a neutral "app header" tone one step off the theme bg.
const SWATCHES: Record<AppTheme, { name: string; bg: string; accent: string; headerBg: string; light?: boolean }> = {
  geometric: { name: 'Geometric Light', bg: '#ffffff', accent: '#3b82f6', headerBg: '#f3f4f6', light: true },
  tactical: { name: 'Tactical Dark', bg: '#0a0a0a', accent: '#10b981', headerBg: '#1a1a1a' },
  luxury: { name: 'Luxury Dark', bg: '#000000', accent: '#d4a853', headerBg: '#151515' },
  aurora: { name: 'Aurora Gradient', bg: '#090d16', accent: '#34d399', headerBg: '#111827' },
  glass: { name: 'Glassmorphism', bg: '#0b0910', accent: '#22d3ee', headerBg: '#17141f' },
}

const THEMES = Object.keys(SWATCHES) as AppTheme[]

// One sparkline shape per slot so adjacent tiles don't look copy-pasted.
const SPARKLINES = [
  '0,14 12,10 24,12 36,6 48,8 60,2',
  '0,12 12,14 24,8 36,10 48,4 60,6',
  '0,10 12,6 24,12 36,4 48,10 60,3',
  '0,13 12,9 24,11 36,5 48,9 60,4',
  '0,12 12,8 24,13 36,6 48,9 60,3',
]

/** Always-visible theme picker: each tile is a tiny caricature of the app
 *  (logo chip, header bar, sparkline) drawn in that theme's own colors. */
export const ThemeSwatchGrid: React.FC = () => {
  const { theme, setTheme } = useThemeStore()
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {THEMES.map((t, i) => {
        const s = SWATCHES[t]
        const isActive = t === theme
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(t)}
            className={`rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              isActive ? 'border-accent' : 'border-border hover:border-accent/50'
            }`}
            style={{ backgroundColor: s.bg }}
          >
            <span className="flex items-center gap-1 mb-1.5" aria-hidden="true">
              <span
                className="w-3.5 h-3.5 rounded-[3px] border shrink-0"
                style={{ backgroundColor: `${s.accent}22`, borderColor: s.accent }}
              />
              <span className="flex-1 h-3.5 rounded-[3px]" style={{ backgroundColor: s.headerBg }} />
            </span>
            <svg viewBox="0 0 60 16" preserveAspectRatio="none" className="w-full h-4 mb-1.5" aria-hidden="true">
              <polyline points={SPARKLINES[i]} fill="none" stroke={s.accent} strokeWidth="1.5" />
            </svg>
            <span
              className="flex items-center justify-between gap-1 text-[12px] font-medium"
              style={{ color: s.light ? '#1f2937' : '#e5e7eb' }}
            >
              {s.name}
              {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: s.accent }} aria-hidden="true" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/components/theme/ThemeSwatchGrid.test.tsx`
Expected: 3 pass (accessible names still come from the visible theme-name text).

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/ThemeSwatchGrid.tsx src/components/theme/ThemeSwatchGrid.test.tsx
git commit -m "feat(settings): theme picker tiles preview the app in each theme"
```

---

### Task 2: Market data section — status badge, inline key row, collapsed instructions

**Files:**
- Modify: `src/components/settings/MarketDataSettings.tsx` (whole file replaced)
- Test: `src/components/settings/MarketDataSettings.test.tsx` (whole file replaced)

**Interfaces:**
- Consumes: `useMarketDataStore` (unchanged: `{ apiKey: string | null, setApiKey(k), clearApiKey() }`).
- Produces: `MarketDataSection` (unchanged export) AND new export `MarketDataStatusBadge: React.FC` (no props; renders a pill reflecting key state). Task 4 places the badge in the card header.

- [ ] **Step 1: Replace the test file with the new expectations**

Replace `src/components/settings/MarketDataSettings.test.tsx` with:

```tsx
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MarketDataSection, MarketDataStatusBadge } from './MarketDataSettings'
import { useMarketDataStore } from '../../store/useMarketDataStore'

describe('MarketDataSection', () => {
  beforeEach(() => useMarketDataStore.getState().clearApiKey())

  it('saves a key', () => {
    render(<MarketDataSection />)
    fireEvent.change(screen.getByLabelText('Alpha Vantage API Key'), { target: { value: 'demo-key-x3P' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(useMarketDataStore.getState().apiKey).toBe('demo-key-x3P')
  })

  it('collapses setup instructions behind a disclosure', () => {
    render(<MarketDataSection />)
    const details = screen.getByText('How to get a free key').closest('details')!
    expect(details.open).toBe(false)
    expect(screen.getByRole('link', { name: 'Get a free API key' })).toHaveAttribute(
      'href',
      'https://www.alphavantage.co/support/#api-key'
    )
  })
})

describe('MarketDataStatusBadge', () => {
  beforeEach(() => useMarketDataStore.getState().clearApiKey())

  it('shows No key when unset', () => {
    render(<MarketDataStatusBadge />)
    expect(screen.getByText('No key')).toBeInTheDocument()
  })

  it('shows key tail when set', () => {
    useMarketDataStore.getState().setApiKey('demo-key-x3P')
    render(<MarketDataStatusBadge />)
    expect(screen.getByText(/Key active …x3P/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/settings/MarketDataSettings.test.tsx`
Expected: FAIL — `MarketDataStatusBadge` is not exported; disclosure test fails.

- [ ] **Step 3: Replace the implementation**

Replace `src/components/settings/MarketDataSettings.tsx` with:

```tsx
import React, { useState } from 'react'
import { useMarketDataStore } from '../../store/useMarketDataStore'

/** Compact key-status pill, rendered by SettingsSheet in the card header. */
export const MarketDataStatusBadge: React.FC = () => {
  const apiKey = useMarketDataStore((s) => s.apiKey)
  return apiKey ? (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/15 text-accent whitespace-nowrap">
      Key active …{apiKey.slice(-3)}
    </span>
  ) : (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-bg-primary/50 text-text-secondary whitespace-nowrap">
      No key
    </span>
  )
}

/** Alpha Vantage key management, rendered inside the Settings sheet. */
export const MarketDataSection: React.FC = () => {
  const { apiKey, setApiKey, clearApiKey } = useMarketDataStore()
  const [input, setInput] = useState('')

  const handleSave = () => {
    setApiKey(input)
    setInput('')
  }

  const handleRemove = () => {
    clearApiKey()
    setInput('')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label htmlFor="market-data-api-key" className="sr-only">
          Alpha Vantage API Key
        </label>
        <input
          id="market-data-api-key"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={apiKey ? 'Replace API key…' : 'Paste API key…'}
          className="flex-1 min-w-0 px-3 py-2 rounded-md border border-border bg-bg-primary/50 text-text-primary text-sm placeholder:text-text-secondary/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:opacity-90 transition-opacity"
        >
          Save
        </button>
        {apiKey && (
          <button
            onClick={handleRemove}
            className="px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <details className="text-[13px]">
        <summary className="cursor-pointer text-accent hover:underline list-none [&::-webkit-details-marker]:hidden select-none">
          How to get a free key
        </summary>
        <ol className="mt-2 text-text-secondary list-decimal list-inside flex flex-col gap-1.5">
          <li>
            Open the free key page:{' '}
            <a
              href="https://www.alphavantage.co/support/#api-key"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Get a free API key
            </a>
          </li>
          <li>Enter your name and email, click &quot;GET FREE API KEY&quot; - the key appears instantly on the page.</li>
          <li>Paste it above and hit Save. The free plan allows 25 lookups per day, so prices refresh automatically at most once every 4 hours.</li>
        </ol>
      </details>

      <p className="text-[12px] text-text-secondary/80">Your key is stored only on this device.</p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/components/settings/MarketDataSettings.test.tsx`
Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/MarketDataSettings.tsx src/components/settings/MarketDataSettings.test.tsx
git commit -m "feat(settings): key status badge, inline key row, collapsible setup guide"
```

---

### Task 3: Backup controls — two equal left-aligned buttons

**Files:**
- Modify: `src/components/settings/BackupControls.tsx:35-51` (the returned JSX only; handlers unchanged)
- Test: `src/components/settings/BackupControls.test.tsx` (existing tests must keep passing; labels change to "Export data" / "Import backup" which still match `/export/i` and `/import/i`)

**Interfaces:**
- Consumes: `backupToBlob`, `backupFilename`, `parseBackupText`, `restoreBackup` from `../../utils/backup` (unchanged).
- Produces: `BackupControls` component, unchanged export/props.

- [ ] **Step 1: Replace the returned JSX**

In `src/components/settings/BackupControls.tsx`, replace the `return (...)` block with:

```tsx
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          <Download className="w-4 h-4" /> Export data
        </button>
        <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors cursor-pointer">
          <Upload className="w-4 h-4" /> Import backup
          <input type="file" accept="application/json" onChange={handleImport} className="sr-only" />
        </label>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/components/settings/BackupControls.test.tsx`
Expected: 2 pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/BackupControls.tsx
git commit -m "feat(settings): backup card gets two equal bordered buttons"
```

---

### Task 4: Settings sheet — grouped section cards + About footer

**Files:**
- Modify: `src/components/settings/SettingsSheet.tsx` (whole file replaced)
- Create: `src/components/settings/SettingsSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (props `{ open, onClose, desktop: 'modal', ariaLabel, panelClassName }`), `ThemeSwatchGrid` (Task 1), `MarketDataSection` + `MarketDataStatusBadge` (Task 2), `BackupControls` (Task 3).
- Produces: `SettingsSheet` with unchanged props `{ open, onClose, onOpenWhatsNew, onOpenDisclaimer }` — `Layout.tsx` keeps working untouched (its sidebar changes are Task 5).

- [ ] **Step 1: Write the failing test**

Create `src/components/settings/SettingsSheet.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsSheet } from './SettingsSheet'

const noop = () => {}

describe('SettingsSheet', () => {
  it('renders the three section cards and the about footer', () => {
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Market data')).toBeInTheDocument()
    expect(screen.getByText('Backup')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /What's New/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Not financial advice/ })).toBeInTheDocument()
  })

  it('about footer buttons close the sheet and open their modals', () => {
    const onClose = vi.fn()
    const onOpenWhatsNew = vi.fn()
    const onOpenDisclaimer = vi.fn()
    render(<SettingsSheet open onClose={onClose} onOpenWhatsNew={onOpenWhatsNew} onOpenDisclaimer={onOpenDisclaimer} />)
    fireEvent.click(screen.getByRole('button', { name: /What's New/ }))
    expect(onClose).toHaveBeenCalled()
    expect(onOpenWhatsNew).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Not financial advice/ }))
    expect(onOpenDisclaimer).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/settings/SettingsSheet.test.tsx`
Expected: FAIL — current sheet renders "Market Data" (capital D) and no "Not financial advice" button.

- [ ] **Step 3: Replace SettingsSheet implementation**

Replace `src/components/settings/SettingsSheet.tsx` with:

```tsx
import React from 'react'
import { Database, LineChart, Palette, Settings, X } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { ThemeSwatchGrid } from '../theme/ThemeSwatchGrid'
import { MarketDataSection, MarketDataStatusBadge } from './MarketDataSettings'
import { BackupControls } from './BackupControls'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  onOpenWhatsNew: () => void
  onOpenDisclaimer: () => void
}

const SectionCard: React.FC<{ icon: React.ReactNode; title: string; badge?: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  title,
  badge,
  children,
}) => (
  <section className="border border-border rounded-lg p-3">
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
        <span className="text-text-secondary" aria-hidden="true">{icon}</span>
        {title}
      </h3>
      {badge}
    </div>
    {children}
  </section>
)

/** Single settings hub: Appearance, Market data, Backup as section cards,
 *  About as a footer row. Modal on desktop, bottom sheet on mobile. */
export const SettingsSheet: React.FC<SettingsSheetProps> = ({ open, onClose, onOpenWhatsNew, onOpenDisclaimer }) => (
  <Sheet
    open={open}
    onClose={onClose}
    desktop="modal"
    ariaLabel="Settings"
    panelClassName="themed-menu rounded-lg w-full max-w-md p-5 flex flex-col gap-3 max-h-[85dvh] overflow-y-auto"
  >
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[18px] font-semibold text-text-primary">
        <Settings className="w-5 h-5 text-accent" /> Settings
      </h2>
      <button
        onClick={onClose}
        aria-label="Close"
        className="text-text-secondary hover:text-accent rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    <SectionCard icon={<Palette className="w-4 h-4" />} title="Appearance">
      <ThemeSwatchGrid />
    </SectionCard>

    <SectionCard icon={<LineChart className="w-4 h-4" />} title="Market data" badge={<MarketDataStatusBadge />}>
      <MarketDataSection />
    </SectionCard>

    <SectionCard icon={<Database className="w-4 h-4" />} title="Backup">
      <BackupControls />
    </SectionCard>

    <div className="flex items-center justify-between pt-2 border-t border-border">
      <button
        onClick={() => { onClose(); onOpenWhatsNew() }}
        className="text-[12px] text-text-secondary hover:text-accent transition-colors"
      >
        v{__APP_VERSION__} · What's New
      </button>
      <button
        onClick={() => { onClose(); onOpenDisclaimer() }}
        className="text-[12px] text-text-secondary/80 hover:text-accent transition-colors"
      >
        Not financial advice
      </button>
    </div>
  </Sheet>
)
```

Note: the old status sentence in `MarketDataSection` is gone (Task 2); the badge now carries that information in the card header.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/settings/`
Expected: all settings tests pass (SettingsSheet 2, MarketDataSettings 4, BackupControls 2).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SettingsSheet.tsx src/components/settings/SettingsSheet.test.tsx
git commit -m "feat(settings): grouped section cards with about footer"
```

---

### Task 5: Sidebar refinements

**Files:**
- Modify: `src/components/Layout.tsx:69-112` (desktop `<nav>` only; imports line 11 gain `Search`)
- Test: `src/components/Layout.test.tsx`

**Interfaces:**
- Consumes: existing `paletteOpen` state + `CommandPalette` (input has placeholder `Jump to a module or tool…`); `navItems`; `setSettingsOpen`, `setWhatsNewOpen`.
- Produces: no interface changes; visual-only.

- [ ] **Step 1: Add failing tests**

Append to `src/components/Layout.test.tsx` inside a new describe block (same file, after the existing one):

```tsx
describe('Layout desktop sidebar', () => {
  it('has no tagline and opens the command palette from the search button', () => {
    render(<MemoryRouter><Layout /></MemoryRouter>)
    expect(screen.queryByText('Command Center')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    expect(screen.getByPlaceholderText('Jump to a module or tool…')).toBeInTheDocument()
  })

  it('marks the active nav item with an accent bar', () => {
    render(<MemoryRouter><Layout /></MemoryRouter>)
    const active = screen.getAllByRole('link', { name: /dashboard/i })
      .find((l) => l.getAttribute('aria-current') === 'page')!
    expect(active.className).toMatch(/border-l-2/)
  })
})
```

Also extend the import at the top of the file: `import { render, screen, fireEvent } from '@testing-library/react'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Layout.test.tsx`
Expected: existing test passes; both new tests FAIL ("Command Center" found / no search button).

- [ ] **Step 3: Edit the desktop nav in Layout.tsx**

Three edits, desktop `<nav>` only:

(a) Import `Search` from lucide-react (line 11):

```tsx
import { LayoutDashboard, Wallet, TrendingUp, PieChart, Calculator, Settings, Search } from 'lucide-react'
```

(b) Replace the header block + nav list (lines 71-98) with:

```tsx
        <div>
          <div className="p-6 pb-3">
            <h1 className="text-2xl font-bold tracking-tighter text-accent font-display">Ledger</h1>
          </div>

          <div className="px-4">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <Search className="w-4 h-4" /> Search
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-border text-text-secondary/80">⌘K</kbd>
            </button>
          </div>

          <div className="px-4 space-y-2 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center px-4 py-3 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold border-l-2 border-accent rounded-l-none'
                      : 'text-text-secondary hover:bg-bg-primary/50 hover:text-text-primary'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
```

(c) Replace the settings dock (lines 100-111) with:

```tsx
        {/* Settings Dock */}
        <div className="p-4 border-t border-border bg-bg-primary/20 flex items-center justify-between">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 transition-colors"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button
            onClick={() => setWhatsNewOpen(true)}
            className="text-[11px] text-text-secondary/70 hover:text-accent transition-colors pr-2"
          >
            v{__APP_VERSION__}
          </button>
        </div>
```

The mobile `<nav>` (bottom tab bar) is untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Layout.test.tsx src/components/CommandPalette.test.tsx`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "feat(nav): sidebar search affordance, active accent bar, tidy dock"
```

---

### Task 6: Verify in browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server preview and open Settings**

Use the Browser pane (`preview_start` with the launch.json dev config). Open the gear popup and confirm: three bordered cards + footer row; disclosure collapsed; theme tiles render sparkline previews in all five themes (click through each); backup buttons equal width.

- [ ] **Step 2: Check the sidebar**

Confirm: no tagline; Search button opens the ⌘K palette; active item shows the left accent bar; dock is one row.

- [ ] **Step 3: Check mobile viewport**

Resize to mobile preset: bottom tab bar unchanged; Settings opens as bottom sheet and scrolls.

- [ ] **Step 4: Console check**

`read_console_messages` with onlyErrors — expect none from these screens.

---

### Task 7: Release v0.6.1-beta

**Files:**
- Modify: `package.json` (version field)
- Modify: `CHANGELOG.md` (new section under `## [Unreleased]`)

- [ ] **Step 1: Bump version**

In `package.json`: `"version": "0.6.1-beta"`.

- [ ] **Step 2: Changelog entry**

Insert below `## [Unreleased]` in `CHANGELOG.md`:

```markdown
## [0.6.1-beta] - 2026-07-16

### Changed
- Settings popup reorganized into cards: Appearance, Market data (key status badge, setup guide collapsed behind "How to get a free key"), Backup, and a compact About footer
- Theme picker tiles now preview the app in each theme (header bar and sparkline in the theme's own colors)
- Sidebar: new Search button reveals the Ctrl/Cmd+K command palette, active page gets an accent bar, settings dock flattened to one row, "Command Center" tagline removed
```

- [ ] **Step 3: Full suite + build**

Run: `npx vitest run`
Expected: all tests pass (405+ across 95+ files).
Run: `npm run build`
Expected: exits 0.
Run: `npx eslint src/components/settings src/components/theme src/components/Layout.tsx`
Expected: no errors in these paths.

- [ ] **Step 4: Commit release**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release v0.6.1-beta"
```

- [ ] **Step 5: Push (after user confirms)**

```bash
git push
```

---

## Self-Review Notes

- Spec coverage: §1 → Tasks 2, 3, 4; §2 → Task 1; §3 → Task 5; testing → each task + Task 6; release → Task 7. The spec's optional `Ctrl K` label detection is dropped in favor of a static `⌘K` chip (spec explicitly allows this) — changelog says "Ctrl/Cmd+K" so Windows users aren't confused.
- What's New modal needs no change: it parses CHANGELOG.md at build time.
- `__APP_VERSION__` comes from `npm_package_version` via vite define — the Task 7 bump automatically updates the sheet footer and sidebar version.
