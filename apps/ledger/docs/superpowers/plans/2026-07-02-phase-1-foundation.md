# Phase 1 — Foundation: Save + PWA + Mobile base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. After each task: commit, then update `PROGRESS.md` (current/next task + Log line). This is Phase 1 of the milestone in `2026-07-02-ledger-v2-master-plan.md`.

**Goal:** Give Ledger a trustworthy foundation — JSON backup export/import, a genuinely installable PWA, and a mobile base that isn't horizontally broken — before any feature work.

**Architecture:** A single `backup.ts` utility owns an explicit registry of the app's LocalStorage keys and serializes/restores them as one versioned JSON envelope. A small UI in `Layout.tsx` triggers download/upload. PWA manifest icons are fixed to resolve under the `/ledger/` base and real PNG icons are added. Minimal responsive guards prevent horizontal overflow on phones (full mobile reflow is Phase 7).

**Tech Stack:** React 19, Vite, Tailwind v4, Zustand `persist`, vite-plugin-pwa, Vitest + Testing Library, jsdom.

## Global Constraints

(Full list in the master plan — these apply to every task.)

- Zero backend / zero-infra; client-side only.
- Every persisted store uses Zustand `persist` → LocalStorage.
- **Backup must cover every persisted store.** Current storage keys (verified in code): `accounts-storage`, `ledger-budget`, `ledger-compensation`, `financial-dashboard-theme`, `ledger-triage`. (`useInvestmentStore`/`useProjectionStore` are NOT persisted yet — later phases add them and MUST append their keys to the registry.)
- No hardcoded colors — theme CSS variables only (e.g. `text-text-primary`, `bg-bg-secondary`, `text-accent`, `border-border`).
- Works in both themes; renders on a phone.

---

### Task 1: Backup export/import core

**Files:**
- Create: `src/utils/backup.ts`
- Test: `src/utils/backup.test.ts`

**Interfaces:**
- Consumes: browser `localStorage` (jsdom provides it in tests).
- Produces:
  - `BACKUP_KEYS: string[]` — the registry of LocalStorage keys.
  - `BACKUP_VERSION: number`
  - `interface BackupEnvelope { version: number; exportedAt: string; app: 'ledger'; data: Record<string, unknown> }`
  - `buildBackup(): BackupEnvelope` — reads each registry key from localStorage (skips absent keys), JSON-parses each value into `data`.
  - `restoreBackup(envelope: BackupEnvelope): void` — validates `app === 'ledger'` and `version <= BACKUP_VERSION`, then writes each `data` entry back to localStorage as a JSON string. Throws `Error('Invalid Ledger backup file')` on a bad envelope.

- [x] **Step 1: Write the failing test**

```ts
// src/utils/backup.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildBackup, restoreBackup, BACKUP_VERSION, type BackupEnvelope } from './backup'

describe('backup', () => {
  beforeEach(() => localStorage.clear())

  it('builds an envelope from present keys and skips absent ones', () => {
    localStorage.setItem('ledger-compensation', JSON.stringify({ a: 1 }))
    const env = buildBackup()
    expect(env.app).toBe('ledger')
    expect(env.version).toBe(BACKUP_VERSION)
    expect(env.data['ledger-compensation']).toEqual({ a: 1 })
    expect('ledger-budget' in env.data).toBe(false)
  })

  it('round-trips: restore writes values back as JSON strings', () => {
    const env: BackupEnvelope = {
      version: BACKUP_VERSION, exportedAt: '2026-07-02T00:00:00Z', app: 'ledger',
      data: { 'ledger-budget': { x: 2 } },
    }
    restoreBackup(env)
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ x: 2 })
  })

  it('rejects a non-Ledger or future-version envelope', () => {
    expect(() => restoreBackup({ app: 'other' } as unknown as BackupEnvelope))
      .toThrow('Invalid Ledger backup file')
    expect(() => restoreBackup({ app: 'ledger', version: BACKUP_VERSION + 1, exportedAt: '', data: {} }))
      .toThrow('Invalid Ledger backup file')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/backup.test.ts`
Expected: FAIL — cannot resolve `./backup`.

- [x] **Step 3: Write minimal implementation**

```ts
// src/utils/backup.ts
export const BACKUP_VERSION = 1

// Registry of every persisted LocalStorage key. Append new keys here when
// later phases add persisted stores (Investments, Projections/Planner, etc.).
export const BACKUP_KEYS: string[] = [
  'accounts-storage',
  'ledger-budget',
  'ledger-compensation',
  'financial-dashboard-theme',
  'ledger-triage',
]

export interface BackupEnvelope {
  version: number
  exportedAt: string
  app: 'ledger'
  data: Record<string, unknown>
}

export function buildBackup(): BackupEnvelope {
  const data: Record<string, unknown> = {}
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      data[key] = raw
    }
  }
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), app: 'ledger', data }
}

export function restoreBackup(envelope: BackupEnvelope): void {
  if (!envelope || envelope.app !== 'ledger' || typeof envelope.version !== 'number' || envelope.version > BACKUP_VERSION) {
    throw new Error('Invalid Ledger backup file')
  }
  for (const [key, value] of Object.entries(envelope.data ?? {})) {
    localStorage.setItem(key, JSON.stringify(value))
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/backup.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: backup export/import core with versioned envelope"
```

---

### Task 2: Backup file I/O helpers (download / read)

**Files:**
- Modify: `src/utils/backup.ts`
- Modify: `src/utils/backup.test.ts`

**Interfaces:**
- Consumes: `buildBackup`, `restoreBackup` from Task 1.
- Produces:
  - `backupToBlob(): Blob` — `buildBackup()` serialized as a pretty JSON `Blob` (`type: 'application/json'`).
  - `backupFilename(): string` — e.g. `ledger-backup-2026-07-02.json` (date from today).
  - `parseBackupText(text: string): BackupEnvelope` — `JSON.parse` then `restoreBackup`-validate the shape (reuse validation by calling `restoreBackup` is NOT wanted here — only parse+validate, no write). Throws `Error('Invalid Ledger backup file')` on malformed JSON or bad envelope.

- [x] **Step 1: Write the failing test**

```ts
// append to src/utils/backup.test.ts
import { backupToBlob, backupFilename, parseBackupText } from './backup'

describe('backup file io', () => {
  beforeEach(() => localStorage.clear())

  it('backupToBlob produces JSON blob', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ x: 2 }))
    const blob = backupToBlob()
    expect(blob.type).toBe('application/json')
    const parsed = JSON.parse(await blob.text())
    expect(parsed.data['ledger-budget']).toEqual({ x: 2 })
  })

  it('backupFilename is date-stamped', () => {
    expect(backupFilename()).toMatch(/^ledger-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('parseBackupText validates and returns the envelope', () => {
    const good = JSON.stringify({ app: 'ledger', version: 1, exportedAt: '', data: {} })
    expect(parseBackupText(good).app).toBe('ledger')
    expect(() => parseBackupText('{not json')).toThrow('Invalid Ledger backup file')
    expect(() => parseBackupText(JSON.stringify({ app: 'nope' }))).toThrow('Invalid Ledger backup file')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/backup.test.ts`
Expected: FAIL — `backupToBlob` / `parseBackupText` not exported.

- [x] **Step 3: Write minimal implementation**

```ts
// append to src/utils/backup.ts
export function backupToBlob(): Blob {
  return new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' })
}

export function backupFilename(): string {
  return `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
}

export function parseBackupText(text: string): BackupEnvelope {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('Invalid Ledger backup file')
  }
  const env = obj as BackupEnvelope
  if (!env || env.app !== 'ledger' || typeof env.version !== 'number' || env.version > BACKUP_VERSION) {
    throw new Error('Invalid Ledger backup file')
  }
  return env
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/backup.test.ts`
Expected: PASS (all backup tests).

- [x] **Step 5: Commit**

```bash
git add src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: backup blob/filename/parse helpers"
```

---

### Task 3: Backup UI (Export / Import) in the nav

**Files:**
- Create: `src/components/settings/BackupControls.tsx`
- Create: `src/components/settings/BackupControls.test.tsx`
- Modify: `src/components/Layout.tsx` (render `<BackupControls />` in the bottom dock beside `<ThemeSelector />`, ~lines 55-58)

**Interfaces:**
- Consumes: `backupToBlob`, `backupFilename`, `parseBackupText`, `restoreBackup` from Tasks 1-2.
- Produces: `BackupControls` React component. Export button downloads the blob; Import button opens a hidden file input, reads the file, calls `parseBackupText` → `restoreBackup`, then `window.location.reload()`. On parse error, shows an inline error message (no crash).

- [x] **Step 1: Write the failing test**

```tsx
// src/components/settings/BackupControls.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BackupControls } from './BackupControls'

describe('BackupControls', () => {
  beforeEach(() => localStorage.clear())

  it('renders export and import controls', () => {
    render(<BackupControls />)
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/import/i)).toBeInTheDocument()
  })

  it('shows an error for an invalid import file', async () => {
    render(<BackupControls />)
    const input = screen.getByLabelText(/import/i) as HTMLInputElement
    const file = new File(['{bad'], 'x.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/invalid ledger backup/i)).toBeInTheDocument())
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/settings/BackupControls.test.tsx`
Expected: FAIL — cannot resolve `./BackupControls`.

- [x] **Step 3: Write minimal implementation**

```tsx
// src/components/settings/BackupControls.tsx
import React, { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { backupToBlob, backupFilename, parseBackupText, restoreBackup } from '../../utils/backup'

export const BackupControls: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = () => {
    const url = URL.createObjectURL(backupToBlob())
    const a = document.createElement('a')
    a.href = url
    a.download = backupFilename()
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const env = parseBackupText(await file.text())
      restoreBackup(env)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid Ledger backup file')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 transition-colors"
        >
          <Download className="w-4 h-4" /> Export
        </button>
        <label className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 transition-colors cursor-pointer">
          <Upload className="w-4 h-4" /> Import
          <input ref={fileRef} type="file" accept="application/json" onChange={handleImport} className="sr-only" />
        </label>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
```

Then in `src/components/Layout.tsx`, replace the theme dock block (lines ~55-58) with:

```tsx
        {/* Backup + Theme Dock */}
        <div className="p-4 border-t border-border bg-bg-primary/20 flex flex-col items-center gap-3 pb-6">
          <BackupControls />
          <ThemeSelector />
        </div>
```

And add the import near the top of `Layout.tsx`:

```tsx
import { BackupControls } from './settings/BackupControls'
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/settings/BackupControls.test.tsx`
Expected: PASS (2 tests).

- [x] **Step 5: Manual sanity + commit**

Run `npm run dev`, click Export (a `ledger-backup-*.json` downloads), then Import that file (page reloads, data intact).

```bash
git add src/components/settings/BackupControls.tsx src/components/settings/BackupControls.test.tsx src/components/Layout.tsx
git commit -m "feat: backup export/import UI in nav dock"
```

---

### Task 4: Fix PWA manifest + add real icons

**Files:**
- Modify: `vite.config.ts` (VitePWA manifest, lines ~12-31)
- Create: `public/icon-192x192.png`, `public/icon-512x512.png`, `public/icon-512x512-maskable.png`

**Interfaces:** none (build/config task).

- [x] **Step 1: Add icon PNGs**

Generate three PNGs from the existing `public/favicon.svg` (or a solid-bg version of it) at 192×192, 512×512, and a 512×512 maskable variant with padding. Use whatever image tooling is available (e.g. `sharp` via `npx`, or an online-free equivalent run locally). Place them in `public/`. They must be non-empty valid PNGs of the correct dimensions.

- [x] **Step 2: Fix the manifest so icons resolve under `/ledger/`**

In `vite.config.ts`, replace the `manifest` block with (note: icon `src` are RELATIVE — leading `/` resolves to the domain root and 404s on GitHub Pages Project Pages):

```ts
      manifest: {
        name: 'Ledger',
        short_name: 'Ledger',
        description: 'A highly scalable, cross-platform financial dashboard',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
```

- [x] **Step 3: Build and verify the generated manifest**

Run: `npm run build`
Expected: build succeeds. Then confirm the emitted manifest references the icons and they exist in the build output:

Run: `ls dist/ | grep icon && cat dist/manifest.webmanifest`
Expected: three `icon-*.png` present in `dist/`; manifest `icons[].src` are relative (no leading `/`); `start_url` and `scope` are `.`.

- [x] **Step 4: Commit**

```bash
git add vite.config.ts public/icon-192x192.png public/icon-512x512.png public/icon-512x512-maskable.png
git commit -m "fix: PWA manifest icon paths + add real app icons"
```

---

### Task 5: Mobile base — prevent horizontal overflow

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `index.html` (viewport meta, line 6)

**Interfaces:** none (layout hardening; full mobile reflow + bottom nav is Phase 7).

- [x] **Step 1: Harden the viewport meta**

In `index.html`, replace the viewport meta with one that respects notches:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [x] **Step 2: Guard the main content from overflow**

In `src/components/Layout.tsx`, add `min-w-0` to the `<main>` so flex children can shrink instead of forcing horizontal scroll, and make its padding responsive:

Change `<main className="flex-1 overflow-auto p-8 relative z-10">` to:

```tsx
      <main className="flex-1 min-w-0 overflow-auto p-4 sm:p-8 relative z-10">
```

- [x] **Step 3: Verify no horizontal overflow at 375px**

Run: `npm run dev`, open DevTools device toolbar at 375px width, load each route. Expected: no horizontal scrollbar on the page body. (The sidebar remains full-width for now; the bottom-nav reflow is Phase 7 — do NOT build it here.)

- [x] **Step 4: Commit**

```bash
git add index.html src/components/Layout.tsx
git commit -m "fix: mobile viewport-fit and prevent horizontal overflow"
```

---

### Task 6: Phase gate — verify, then close Phase 1

- [x] **Step 1: Full verification**

Run each and confirm clean:
- `npm test` → all pass
- `npm run build` → succeeds
- `npm run lint` → no errors

- [x] **Step 2: Update PROGRESS.md**

Mark Phase 1 `- [x]`, set current phase to 2, next task to "plan Phase 2 JIT", append Log lines for P1.T1–T5.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/PROGRESS.md
git commit -m "chore: complete Phase 1 foundation"
```

**Phase 1 done when:** user can install the PWA on a phone, use the app offline (shell), and export → clear browser data → import their backup losslessly; no horizontal overflow at 375px; tests/build/lint clean.
