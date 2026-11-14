# Mobile-Friendly Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ledger's mobile experience polished and bug-free by reflowing every desktop overlay (modal, dropdown, popover) into a bottom sheet and every wide table into cards, without changing the desktop experience.

**Architecture:** Introduce three self-contained UI primitives — `useMediaQuery`, `useScrollLock`, and a portal-based `Sheet` — then route the 9 existing modals and 6 anchored popovers through `Sheet` (which renders a centered dialog / anchored popover on desktop and a swipe-dismissible bottom sheet on mobile), convert 4 wide tables to mobile card layouts, fix one grid-collapse bug, and correct the layout's safe-area padding and horizontal-overflow backstop. No store, service, or data-model changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (CSS-variable theme tokens), framer-motion 12 (already a dependency — used for sheet animation + drag), Zustand, Vitest + @testing-library/react (jsdom).

## Global Constraints

- **No new dependencies.** Animation/drag uses framer-motion (already installed). (spec: "Base library … No new packages.")
- **Desktop preserved.** Desktop (`≥ md`, i.e. `min-width: 768px`) rendering must stay visually and behaviorally as-is; desktop visual changes are allowed **only** when clearly positive, and must be called out. (spec: "Decisions → Shared components".)
- **Mobile breakpoint = Tailwind `md` = `min-width: 768px`.** Below this is "mobile" (bottom sheets, cards).
- **Theme:** use existing CSS-variable tokens only (`var(--accent)`, `text-text-primary`, `themed-card`, `themed-menu`, etc.). No palette or desktop-typography changes.
- **Sheet dismissal on mobile:** swipe-down-past-threshold **and** scrim-tap **and** close button **and** `Escape` — except when `dismissible={false}`.
- **Accessibility:** overlays keep `role="dialog"`/`aria-modal`, trap focus while open, restore focus to the trigger on close, respect `prefers-reduced-motion` (framer-motion `useReducedMotion` → fade only, no slide/drag transform), and keep visible focus states. Mobile tap targets ≥ 44px.
- **Tests:** TDD. `npm test` must be green and `npm run build` (tsc + vite) clean at the end of every phase. Match existing test conventions (`vitest` globals, `@testing-library/react`, `@testing-library/jest-dom`).

---

## File Structure

**New files:**
- `src/hooks/useMediaQuery.ts` — reactive `matchMedia` hook; single responsibility: report whether a media query matches.
- `src/hooks/useMediaQuery.test.tsx`
- `src/hooks/useScrollLock.ts` — reference-counted body-scroll lock.
- `src/hooks/useScrollLock.test.tsx`
- `src/components/ui/Sheet.tsx` — portal overlay primitive (desktop modal/popover ↔ mobile bottom sheet) + exported pure helper `shouldDismissOnDragEnd`.
- `src/components/ui/Sheet.test.tsx`
- `src/components/ui/sheet.ts` — shared constants/helpers (`SWIPE_DISMISS_OFFSET`, `SWIPE_DISMISS_VELOCITY`, `shouldDismissOnDragEnd`). Kept separate so the pure logic is unit-testable without rendering.

**Modified files (grouped by phase):**
- Phase 0: `src/setupTests.ts` (add `matchMedia` mock).
- Phase 2 (modals): `AnalysisModal`, `CompensationModal`, `TransactionModal`, `AddAccountModal`, `CSVUploader`, `MarketDataSettings`, `WhatsNewModal`, `DisclaimerModal`, `CommandPalette`.
- Phase 3 (popovers): `ToolSwitcher`, `ToolInfoButton`, `ThemeSelector`, `ThemedSelect`, `ThemedDatePicker`.
- Phase 4 (data): `ActualTable`, `PlanTable`, `PortfolioView`, `TransactionListWidget`, `DebtPayoffCalculator`.
- Phase 5 (layout): `Layout`.

---

## PHASE 0 — Test infrastructure

### Task 0: Add a `matchMedia` mock to the test setup

jsdom does not implement `window.matchMedia`; `useMediaQuery` and `Sheet` will throw in tests without it. Add a controllable mock.

**Files:**
- Modify: `src/setupTests.ts`

**Interfaces:**
- Produces: a global `window.matchMedia` returning a `MediaQueryList`-shaped object whose `matches` is driven by a module the tests can control via `setMatchMedia(matches: boolean)`.
- Produces: `src/test-utils/matchMedia.ts` exporting `setMatchMedia(matches: boolean)` and `resetMatchMedia()`.

- [ ] **Step 1: Create the controllable mock helper**

Create `src/test-utils/matchMedia.ts`:

```ts
// Controllable window.matchMedia mock for jsdom. Tests call setMatchMedia(true|false)
// to simulate desktop (>=768px => true for '(min-width: 768px)') or mobile.
type Listener = (e: { matches: boolean }) => void

let currentMatches = true // default: desktop
const listeners = new Set<Listener>()

export function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: currentMatches,
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: Listener) => listeners.add(cb),
      removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
      // Deprecated APIs some libraries still call:
      addListener: (cb: Listener) => listeners.add(cb),
      removeListener: (cb: Listener) => listeners.delete(cb),
      dispatchEvent: () => false,
    }),
  })
}

export function setMatchMedia(matches: boolean): void {
  currentMatches = matches
  listeners.forEach((cb) => cb({ matches }))
}

export function resetMatchMedia(): void {
  currentMatches = true
  listeners.clear()
}
```

- [ ] **Step 2: Install the mock globally in setup**

Edit `src/setupTests.ts` to:

```ts
import '@testing-library/jest-dom';
import { installMatchMedia } from './test-utils/matchMedia'

installMatchMedia()
```

- [ ] **Step 3: Verify existing suite still passes**

Run: `npm test -- --run`
Expected: PASS (no regressions; new mock is additive).

- [ ] **Step 4: Commit**

```bash
git add src/setupTests.ts src/test-utils/matchMedia.ts
git commit -m "test: add controllable matchMedia mock for jsdom"
```

---

## PHASE 1 — Primitives

### Task 1: `useMediaQuery` hook

**Files:**
- Create: `src/hooks/useMediaQuery.ts`
- Test: `src/hooks/useMediaQuery.test.tsx`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean` — reactive; re-renders when the match state changes. Convenience: `useIsDesktop(): boolean` = `useMediaQuery('(min-width: 768px)')`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useMediaQuery.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useIsDesktop } from './useMediaQuery'
import { setMatchMedia, resetMatchMedia } from '../test-utils/matchMedia'

function Probe() {
  const desktop = useIsDesktop()
  return <span data-testid="v">{desktop ? 'desktop' : 'mobile'}</span>
}

describe('useIsDesktop', () => {
  beforeEach(() => resetMatchMedia())

  it('reports desktop when the query matches', () => {
    setMatchMedia(true)
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('v').textContent).toBe('desktop')
  })

  it('reacts to media changes', () => {
    setMatchMedia(true)
    const { getByTestId } = render(<Probe />)
    act(() => setMatchMedia(false))
    expect(getByTestId('v').textContent).toBe('mobile')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/hooks/useMediaQuery.test.tsx`
Expected: FAIL ("Cannot find module './useMediaQuery'").

- [ ] **Step 3: Implement**

Create `src/hooks/useMediaQuery.ts`:

```ts
import { useEffect, useState } from 'react'

/** Reactive matchMedia. SSR-safe (returns false when window is absent). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent | { matches: boolean }) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange as (e: MediaQueryListEvent) => void)
    return () => mql.removeEventListener('change', onChange as (e: MediaQueryListEvent) => void)
  }, [query])

  return matches
}

export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 768px)')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/hooks/useMediaQuery.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMediaQuery.ts src/hooks/useMediaQuery.test.tsx
git commit -m "feat: add useMediaQuery/useIsDesktop hook"
```

---

### Task 2: `useScrollLock` hook (reference-counted)

**Files:**
- Create: `src/hooks/useScrollLock.ts`
- Test: `src/hooks/useScrollLock.test.tsx`

**Interfaces:**
- Produces: `useScrollLock(active: boolean): void`. While any consumer is `active`, `document.body.style.overflow = 'hidden'` and `document.body.style.paddingRight` compensates for scrollbar width. Reference-counted: body unlocks only when the last active consumer deactivates. Restores original inline styles when the count returns to zero.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useScrollLock.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useScrollLock } from './useScrollLock'

function Locker({ active }: { active: boolean }) {
  useScrollLock(active)
  return null
}

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

  it('locks body scroll while active and restores on unmount', () => {
    const { rerender, unmount } = render(<Locker active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Locker active={false} />)
    expect(document.body.style.overflow).toBe('')
    rerender(<Locker active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('stays locked until the LAST consumer releases (reference counted)', () => {
    const a = render(<Locker active={true} />)
    const b = render(<Locker active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    a.unmount()
    expect(document.body.style.overflow).toBe('hidden') // b still active
    b.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/hooks/useScrollLock.test.tsx`
Expected: FAIL ("Cannot find module './useScrollLock'").

- [ ] **Step 3: Implement**

Create `src/hooks/useScrollLock.ts`:

```ts
import { useEffect } from 'react'

let lockCount = 0
let savedOverflow = ''
let savedPaddingRight = ''

function lock() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    const body = document.body
    savedOverflow = body.style.overflow
    savedPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
  }
  lockCount++
}

function unlock() {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow
    document.body.style.paddingRight = savedPaddingRight
  }
}

/** Freezes body scroll while `active`. Reference-counted so nested/stacked
 *  overlays don't unlock the page prematurely. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/hooks/useScrollLock.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScrollLock.ts src/hooks/useScrollLock.test.tsx
git commit -m "feat: add reference-counted useScrollLock hook"
```

---

### Task 3: Sheet drag-dismiss helper (pure logic)

Extract the swipe-threshold decision so it's unit-testable without simulating pointer physics.

**Files:**
- Create: `src/components/ui/sheet.ts`
- Test: `src/components/ui/sheet.test.ts`

**Interfaces:**
- Produces: `SWIPE_DISMISS_OFFSET = 120` (px), `SWIPE_DISMISS_VELOCITY = 500` (px/s), and `shouldDismissOnDragEnd(offsetY: number, velocityY: number): boolean` — true when dragged down far enough OR flicked down fast enough.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/sheet.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { shouldDismissOnDragEnd } from './sheet'

describe('shouldDismissOnDragEnd', () => {
  it('dismisses when dragged past the offset threshold', () => {
    expect(shouldDismissOnDragEnd(150, 0)).toBe(true)
  })
  it('dismisses on a fast downward flick even with small offset', () => {
    expect(shouldDismissOnDragEnd(20, 800)).toBe(true)
  })
  it('does not dismiss on a small, slow drag', () => {
    expect(shouldDismissOnDragEnd(40, 100)).toBe(false)
  })
  it('does not dismiss on upward drags', () => {
    expect(shouldDismissOnDragEnd(-200, -900)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/sheet.test.ts`
Expected: FAIL ("Cannot find module './sheet'").

- [ ] **Step 3: Implement**

Create `src/components/ui/sheet.ts`:

```ts
export const SWIPE_DISMISS_OFFSET = 120 // px dragged down
export const SWIPE_DISMISS_VELOCITY = 500 // px/s downward flick

/** Decide whether a downward drag-end should dismiss the sheet. */
export function shouldDismissOnDragEnd(offsetY: number, velocityY: number): boolean {
  return offsetY > SWIPE_DISMISS_OFFSET || velocityY > SWIPE_DISMISS_VELOCITY
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/sheet.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/sheet.ts src/components/ui/sheet.test.ts
git commit -m "feat: add sheet drag-dismiss threshold helper"
```

---

### Task 4: `Sheet` primitive component

The core overlay. Portal → scrim → panel. Desktop: centered dialog (`desktop="modal"`) or anchored popover (`desktop="popover"`). Mobile: bottom sheet with drag handle, swipe/scrim/Esc/button dismissal, safe-area padding. Locks body scroll while open. Traps and restores focus.

**Files:**
- Create: `src/components/ui/Sheet.tsx`
- Test: `src/components/ui/Sheet.test.tsx`

**Interfaces:**
- Consumes: `useIsDesktop` (Task 1), `useScrollLock` (Task 2), `shouldDismissOnDragEnd` (Task 3).
- Produces:

```ts
interface SheetProps {
  open: boolean
  onClose: () => void
  /** Desktop rendering. 'modal' = centered dialog; 'popover' = anchored to anchorRef. Default 'modal'. */
  desktop?: 'modal' | 'popover'
  /** Required when desktop='popover': the trigger element to anchor to on desktop. */
  anchorRef?: React.RefObject<HTMLElement | null>
  /** When false, scrim-tap / swipe / Esc do NOT close (caller-controlled dismissal, e.g. required disclaimer). Default true. */
  dismissible?: boolean
  ariaLabel?: string
  labelledBy?: string
  /** Extra classes for the panel container (e.g. max-width on desktop modal). */
  panelClassName?: string
  /** Optional title shown in the mobile sheet header row (desktop ignores it; callers keep their own headers). */
  children: React.ReactNode
}
export const Sheet: React.FC<SheetProps>
```

- Behavior contract used by later tasks:
  - Renders nothing when `open` is false.
  - Renders into a portal on `document.body`.
  - Scrim has `data-testid="sheet-scrim"`; panel has `role="dialog"` `aria-modal="true"` and `data-testid="sheet-panel"`.
  - Mobile close button has `aria-label="Close"`.
  - When `dismissible`, scrim click and `Escape` call `onClose`; when not, they do nothing.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/Sheet.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { Sheet } from './Sheet'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

beforeEach(() => resetMatchMedia())

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(
      <Sheet open={false} onClose={() => {}} ariaLabel="x">body</Sheet>
    )
    expect(queryByTestId('sheet-panel')).toBeNull()
  })

  it('renders a dialog panel when open', () => {
    const { getByTestId, getByText } = render(
      <Sheet open onClose={() => {}} ariaLabel="x">hello</Sheet>
    )
    expect(getByTestId('sheet-panel').getAttribute('role')).toBe('dialog')
    expect(getByText('hello')).toBeInTheDocument()
  })

  it('closes on scrim click when dismissible', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(
      <Sheet open onClose={onClose} ariaLabel="x">c</Sheet>
    )
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape when dismissible', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose} ariaLabel="x">c</Sheet>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT close on scrim/Escape when dismissible=false', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(
      <Sheet open onClose={onClose} dismissible={false} ariaLabel="x">c</Sheet>
    )
    fireEvent.click(getByTestId('sheet-scrim'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows a Close button on mobile that calls onClose', () => {
    setMatchMedia(false) // mobile
    const onClose = vi.fn()
    const { getByLabelText } = render(
      <Sheet open onClose={onClose} ariaLabel="x">c</Sheet>
    )
    fireEvent.click(getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('locks body scroll while open', () => {
    const { unmount } = render(<Sheet open onClose={() => {}} ariaLabel="x">c</Sheet>)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/components/ui/Sheet.test.tsx`
Expected: FAIL ("Cannot find module './Sheet'").

- [ ] **Step 3: Implement the Sheet**

Create `src/components/ui/Sheet.tsx`:

```tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { useScrollLock } from '../../hooks/useScrollLock'
import { shouldDismissOnDragEnd } from './sheet'

interface SheetProps {
  open: boolean
  onClose: () => void
  desktop?: 'modal' | 'popover'
  anchorRef?: React.RefObject<HTMLElement | null>
  dismissible?: boolean
  ariaLabel?: string
  labelledBy?: string
  panelClassName?: string
  children: React.ReactNode
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  desktop = 'modal',
  anchorRef,
  dismissible = true,
  ariaLabel,
  labelledBy,
  panelClassName = '',
  children,
}) => {
  const isDesktop = useIsDesktop()
  const reduced = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)
  useScrollLock(open)

  // Escape to close.
  useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  // Focus management: focus the panel on open, restore to trigger on close.
  useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement as HTMLElement
      // focus first focusable, else the panel
      const el = panelRef.current
      const focusable = el?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      ;(focusable ?? el)?.focus()
    } else {
      lastFocused.current?.focus?.()
    }
  }, [open])

  // Desktop popover anchor position.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    if (!open || !isDesktop || desktop !== 'popover' || !anchorRef?.current) return
    const r = anchorRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, left: r.left })
  }, [open, isDesktop, desktop, anchorRef])

  if (typeof document === 'undefined') return null

  const scrim = (
    <motion.div
      data-testid="sheet-scrim"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.15 }}
      onClick={() => dismissible && onClose()}
      aria-hidden="true"
    />
  )

  const commonPanelProps = {
    ref: panelRef,
    role: 'dialog',
    'aria-modal': true,
    'aria-label': ariaLabel,
    'aria-labelledby': labelledBy,
    tabIndex: -1,
    'data-testid': 'sheet-panel',
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  } as const

  // ---- Desktop: modal (centered) ----
  if (isDesktop && desktop === 'modal') {
    return createPortal(
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {scrim}
            <motion.div
              {...commonPanelProps}
              className={`relative z-50 my-8 ${panelClassName}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: reduced ? 0 : 0.15 }}
            >
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )
  }

  // ---- Desktop: popover (anchored) ----
  if (isDesktop && desktop === 'popover') {
    return createPortal(
      <AnimatePresence>
        {open && (
          <>
            {scrim}
            <motion.div
              {...commonPanelProps}
              className={`fixed z-50 ${panelClassName}`}
              style={{
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                maxWidth: 'calc(100vw - 16px)',
              }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: reduced ? 0 : 0.12 }}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )
  }

  // ---- Mobile: bottom sheet ----
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (dismissible && shouldDismissOnDragEnd(info.offset.y, info.velocity.y)) onClose()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end">
          {scrim}
          <motion.div
            {...commonPanelProps}
            className={`relative z-50 w-full max-h-[90dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-[var(--dropdown-bg)] shadow-2xl ${panelClassName}`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={reduced ? { opacity: 0 } : { y: '100%' }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'tween', duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
            drag={reduced ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className="sticky top-0 flex items-center justify-between px-4 pt-3 pb-2 bg-[var(--dropdown-bg)]">
              <span className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden="true" />
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute right-3 top-3 p-1 text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/components/ui/Sheet.test.tsx`
Expected: PASS (all 7).

> Note: framer-motion's `drag` requires no extra jsdom setup because the swipe path is unit-tested separately (Task 3). If `AnimatePresence` exit animations cause act() warnings, they are non-fatal; keep assertions on presence/close callbacks, not on exit timing.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b --noEmit` (Expected: clean)

```bash
git add src/components/ui/Sheet.tsx src/components/ui/Sheet.test.tsx
git commit -m "feat: add Sheet overlay primitive (desktop modal/popover, mobile bottom sheet)"
```

---

## PHASE 2 — Migrate modals to `Sheet`

**Migration recipe (applies to every modal task in this phase).** Each modal today is:

```tsx
if (!isOpen) return null
return (
  <div className="fixed inset-0 z-50 ... bg-black/50 ..." onClick={onClose} role="dialog" aria-modal ...>
    <div className="<card classes: themed-card / bg-... max-w-... max-h-... overflow-y-auto>" onClick={(e) => e.stopPropagation()}>
      {/* inner content, incl. its own header with a Close (X) button */}
    </div>
  </div>
)
```

Transform to:

```tsx
return (
  <Sheet
    open={isOpen}
    onClose={onClose}
    desktop="modal"
    ariaLabel="<existing aria-label>"
    panelClassName="<the card's width/style classes, e.g. 'w-full max-w-lg themed-card rounded-lg'>"
  >
    {/* SAME inner content */}
  </Sheet>
)
```

Rules for every modal migration:
1. Remove the `if (!isOpen) return null` early-return **only if** `Sheet` now gates on `open` — keep any hooks above it unconditional (React rules of hooks). Move `isOpen` gating into `Sheet`'s `open` prop. If the component had `useEffect` for Escape handling, **delete it** (Sheet owns Escape) — but keep any other effects.
2. Delete the outer `fixed inset-0` wrapper and the inner card's `max-h-[..vh] overflow-y-auto` (Sheet's panel scrolls). Keep the card's background/border/padding/`max-w-*` on `panelClassName` so desktop looks identical.
3. Keep the content's existing header + its X button (desktop shows it; mobile also shows Sheet's own X — that's acceptable, or pass the header through; keeping both is fine and low-risk). 
4. Import: `import { Sheet } from '<relative>/ui/Sheet'`.
5. **Desktop visual check:** the modal must look the same at ≥768px. The one intended, positive cross-modal change: `AnalysisModal` currently top-aligns (`items-start pt-[8vh]`); it will now center like the others — call this out in the commit.

Each task: adjust/author a test asserting open→content visible, close via `onClose`, and that the primary action still fires; then migrate; then run tests; then commit.

---

### Task 5: Migrate `AnalysisModal`

**Files:**
- Modify: `src/components/investments/AnalysisModal.tsx` (wrapper at lines 243–251; inner panels at 59–112 and 161–228)
- Test: `src/components/investments/AnalysisModal.test.tsx` (exists — extend)

**Interfaces:**
- Consumes: `Sheet` (Task 4).

- [ ] **Step 1: Read the existing test and add a close-path assertion**

Open `src/components/investments/AnalysisModal.test.tsx`. Add a test that clicking the scrim closes:

```tsx
import { setMatchMedia } from '../../test-utils/matchMedia'
// ... within describe:
it('closes when the scrim is clicked (desktop)', () => {
  setMatchMedia(true)
  const onClose = vi.fn()
  const { getByTestId } = render(<AnalysisModal isOpen onClose={onClose} />)
  fireEvent.click(getByTestId('sheet-scrim'))
  expect(onClose).toHaveBeenCalled()
})
```

(Keep all existing assertions; they should still pass through the `Sheet`.)

- [ ] **Step 2: Run to see the new test fail**

Run: `npm test -- --run src/components/investments/AnalysisModal.test.tsx`
Expected: FAIL (no `sheet-scrim` yet).

- [ ] **Step 3: Migrate the wrapper**

In `AnalysisModal.tsx`:
- Add import: `import { Sheet } from '../ui/Sheet'`.
- Replace the outer return (lines 243–251) with:

```tsx
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      desktop="modal"
      ariaLabel={analysisId ? 'Add position' : 'New analysis'}
      panelClassName="w-full max-w-lg"
    >
      {analysisId ? (
        <AddPositionModal analysisId={analysisId} onClose={onClose} />
      ) : (
        <NewAnalysisModal onClose={onClose} />
      )}
    </Sheet>
  )
```

- Remove the `useEffect` Escape handler (lines 232–239) and the `if (!isOpen) return null` (line 241).
- In `AddPositionModal` and `NewAnalysisModal`, change each inner root `<div className="themed-card rounded-lg p-6 w-full max-w-lg flex flex-col gap-4 max-h-[84vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>` to `<div className="themed-card rounded-lg p-6 flex flex-col gap-4">` (drop `max-h/overflow/max-w/w-full` and the stopPropagation — Sheet handles both).

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/components/investments/AnalysisModal.test.tsx`
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/components/investments/AnalysisModal.tsx src/components/investments/AnalysisModal.test.tsx
git commit -m "feat(mobile): route AnalysisModal through Sheet (bottom sheet on mobile); center on desktop"
```

---

### Task 6: Migrate `CompensationModal`

**Files:**
- Modify: `src/components/compensation/CompensationModal.tsx` (wrapper at lines 171–173 and closing 525–527; Escape effect 67–74; `if (!isOpen) return null` at 76)
- Test: `src/components/compensation/CompensationModal.test.tsx` (exists — extend)

- [ ] **Step 1: Add a scrim-close test** (mirror Task 5 Step 1, importing `setMatchMedia`, rendering `<CompensationModal isOpen onClose={onClose} />`, asserting scrim click calls `onClose`).

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- --run src/components/compensation/CompensationModal.test.tsx`
Expected: FAIL (no `sheet-scrim`).

- [ ] **Step 3: Migrate**

- Add import `import { Sheet } from '../ui/Sheet'`.
- Delete the Escape `useEffect` (67–74) and `if (!isOpen) return null` (76).
- Replace the outer wrapper (line 172) and its inner container (line 173) with a single `Sheet`; keep everything from line 174 (`<div ... border-b>` header) through 525 as children:

```tsx
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      desktop="modal"
      ariaLabel="Edit Compensation Package"
      panelClassName="w-full max-w-2xl bg-[var(--color-bg-primary)] rounded-xl shadow-lg border border-[var(--color-border)] overflow-hidden flex flex-col"
    >
      {/* existing content from the old inner <div>, unchanged */}
    </Sheet>
  )
```

Remove the old inner `<div className="w-full max-w-2xl ... max-h-[90vh] overflow-y-auto ...">` open/close tags (the `max-h/overflow-y-auto` is dropped; Sheet scrolls).

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/components/compensation/CompensationModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compensation/CompensationModal.tsx src/components/compensation/CompensationModal.test.tsx
git commit -m "feat(mobile): route CompensationModal through Sheet"
```

---

### Task 7: Migrate `TransactionModal`, `AddAccountModal`, `CSVUploader`

These three follow the recipe identically. Do them as one task (all are the same mechanical transform; each keeps its own content and aria-label). Each has/keeps a test asserting open + scrim-close.

**Files:**
- Modify: `src/components/budget/TransactionModal.tsx`, `src/components/dashboard/AddAccountModal.tsx`, `src/components/budget/CSVUploader.tsx`
- Test: `src/components/budget/TransactionModal.test.tsx` (exists — extend); create `src/components/dashboard/AddAccountModal.test.tsx` and `src/components/budget/CSVUploader.test.tsx` if absent (smoke tests).

- [ ] **Step 1: For each file, read its outer wrapper** and note: the aria-label, and the card's width/style classes.

- [ ] **Step 2: Write/extend a smoke test per component**

For any component lacking a test, create one:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { setMatchMedia } from '../../test-utils/matchMedia'
import { AddAccountModal } from './AddAccountModal' // adjust name/props per component

describe('AddAccountModal', () => {
  it('renders when open and closes via scrim', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<AddAccountModal isOpen onClose={onClose} /* + required props */ />)
    expect(getByTestId('sheet-panel')).toBeInTheDocument()
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

Run: `npm test -- --run src/components/dashboard/AddAccountModal.test.tsx`
Expected: FAIL initially (no `sheet-panel`).

- [ ] **Step 3: Migrate each per the recipe.** Add `import { Sheet } from '<...>/ui/Sheet'`; replace outer wrapper with `<Sheet open={isOpen} onClose={onClose} desktop="modal" ariaLabel="<existing>" panelClassName="<card classes minus max-h/overflow>">…</Sheet>`; delete each component's Escape `useEffect` and `if (!isOpen) return null`; drop the inner `stopPropagation` and `max-h/overflow-y-auto`.

- [ ] **Step 4: Run the budget + dashboard suites**

Run: `npm test -- --run src/components/budget src/components/dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/TransactionModal.tsx src/components/dashboard/AddAccountModal.tsx src/components/budget/CSVUploader.tsx src/components/budget/TransactionModal.test.tsx src/components/dashboard/AddAccountModal.test.tsx src/components/budget/CSVUploader.test.tsx
git commit -m "feat(mobile): route TransactionModal, AddAccountModal, CSVUploader through Sheet"
```

---

### Task 8: Migrate `MarketDataSettings` and `WhatsNewModal`

Same recipe. `MarketDataSettings` contains an API-key input — after migration verify the key field still commits. `WhatsNewModal` takes a `swUpdate` prop and its own content; keep both.

**Files:**
- Modify: `src/components/settings/MarketDataSettings.tsx`, `src/components/ui/WhatsNewModal.tsx`
- Test: `src/components/settings/MarketDataSettings.test.tsx` (exists — extend); create `src/components/ui/WhatsNewModal.test.tsx` (smoke) if absent.

- [ ] **Step 1:** Extend `MarketDataSettings.test.tsx` with a scrim-close assertion (desktop), preserving existing key-persistence assertions.
- [ ] **Step 2:** Run `npm test -- --run src/components/settings/MarketDataSettings.test.tsx` → FAIL on the new assertion.
- [ ] **Step 3:** Migrate both files per the recipe (import Sheet, replace wrapper, delete Escape effect + `if (!isOpen) return null`, drop inner max-h/overflow/stopPropagation).
- [ ] **Step 4:** Run `npm test -- --run src/components/settings src/components/ui/WhatsNewModal.test.tsx` → PASS.
- [ ] **Step 5:** Commit.

```bash
git add src/components/settings/MarketDataSettings.tsx src/components/ui/WhatsNewModal.tsx src/components/settings/MarketDataSettings.test.tsx src/components/ui/WhatsNewModal.test.tsx
git commit -m "feat(mobile): route MarketDataSettings and WhatsNewModal through Sheet"
```

---

### Task 9: Migrate `DisclaimerModal` (non-dismissible when ack required)

`DisclaimerModal` has `requireAck`: when true, it must NOT close on scrim/Esc/swipe — only via its own "I Understand" button. Map `requireAck` → `dismissible={!requireAck}`.

**Files:**
- Modify: `src/components/ui/DisclaimerModal.tsx`
- Test: `src/components/ui/DisclaimerModal.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { setMatchMedia } from '../../test-utils/matchMedia'
import { DisclaimerModal } from './DisclaimerModal'

describe('DisclaimerModal', () => {
  it('does not close on scrim click when ack is required', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<DisclaimerModal isOpen requireAck onClose={onClose} />)
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).not.toHaveBeenCalled()
  })
  it('closes on scrim click when ack is not required', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<DisclaimerModal isOpen requireAck={false} onClose={onClose} />)
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2:** Run `npm test -- --run src/components/ui/DisclaimerModal.test.tsx` → FAIL.
- [ ] **Step 3:** Migrate: `<Sheet open={isOpen} onClose={onClose} desktop="modal" dismissible={!requireAck} ariaLabel="Disclaimer" panelClassName="<card classes>">…</Sheet>`; delete Escape effect + `if (!isOpen) return null`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit.

```bash
git add src/components/ui/DisclaimerModal.tsx src/components/ui/DisclaimerModal.test.tsx
git commit -m "feat(mobile): route DisclaimerModal through Sheet, preserving required-ack non-dismissal"
```

---

### Task 10: Migrate `CommandPalette`

The command palette is a top-anchored input+list, not a centered card. On mobile a bottom sheet is fine; on desktop keep its current top-centered placement. Because its desktop placement is bespoke, use `desktop="modal"` but pass `panelClassName` that pins it near the top (`mt-[10vh] self-start`) — or keep its existing outer wrapper and only add `useScrollLock(isOpen)` + Escape via Sheet. Simplest low-risk path: **wrap in Sheet with `desktop="modal"`** and set `panelClassName="w-full max-w-xl"`; accept centered placement on desktop as a positive change (still fully usable), OR keep bespoke top offset via `panelClassName="w-full max-w-xl mt-[-6vh]"`. Preserve `Cmd/Ctrl+K` open behavior in `Layout` (unchanged) and the palette's internal arrow-key/Enter navigation.

**Files:**
- Modify: `src/components/CommandPalette.tsx`
- Test: `src/components/CommandPalette.test.tsx` (create if absent — smoke: opens, renders input, Escape closes)

- [ ] **Step 1:** Write/extend smoke test: open → input present; scrim click → `onClose`. `npm test` → FAIL.
- [ ] **Step 2:** Migrate wrapper to `Sheet`; delete its Escape effect and `if (!isOpen) return null`; keep the palette's own keydown handling for arrows/Enter (those are not Escape). Ensure the search input still autofocuses (Sheet focuses the first focusable, which is the input — good).
- [ ] **Step 3:** Run `npm test -- --run src/components/CommandPalette.test.tsx` → PASS.
- [ ] **Step 4: Full regression + build**

Run: `npm test -- --run` (Expected: all PASS)
Run: `npm run build` (Expected: clean)

- [ ] **Step 5:** Commit.

```bash
git add src/components/CommandPalette.tsx src/components/CommandPalette.test.tsx
git commit -m "feat(mobile): route CommandPalette through Sheet"
```

---

## PHASE 3 — Migrate anchored popovers to `Sheet`

Popovers differ from modals: on desktop they anchor to a trigger. Use `desktop="popover"` with an `anchorRef` on the trigger button. On mobile they become bottom sheets. Each currently manages its own `open` state and outside-click close — keep the state, remove the manual outside-click/Escape handling (Sheet's scrim + Escape replace it), and pass the trigger ref.

### Task 11: Migrate `ToolInfoButton`

**Files:**
- Modify: `src/components/planner/ToolInfoButton.tsx`
- Test: `src/components/planner/ToolInfoButton.test.tsx` (exists — extend)

**Interfaces:**
- Consumes: `Sheet` (Task 4).

- [ ] **Step 1: Extend the test**

Add: mobile (`setMatchMedia(false)`) → clicking the info button shows `sheet-panel` containing the tool name; scrim click closes.

```tsx
import { setMatchMedia } from '../../test-utils/matchMedia'
it('opens an info sheet on mobile and closes via scrim', () => {
  setMatchMedia(false)
  const { getByLabelText, getByTestId, queryByTestId } = render(<ToolInfoButton tool={sampleTool} />)
  fireEvent.click(getByLabelText('About this tool'))
  expect(getByTestId('sheet-panel')).toBeInTheDocument()
  fireEvent.click(getByTestId('sheet-scrim'))
  expect(queryByTestId('sheet-panel')).toBeNull()
})
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Migrate**

```tsx
import React, { useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { PlannerTool } from './toolRegistry'
import { Sheet } from '../ui/Sheet'

export const ToolInfoButton: React.FC<{ tool: PlannerTool }> = ({ tool }) => {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label="About this tool"
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-full text-text-secondary hover:text-accent transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        desktop="popover"
        anchorRef={btnRef}
        ariaLabel={`${tool.name} help`}
        panelClassName="w-[32rem] max-w-[calc(100vw-1rem)] themed-menu rounded-lg shadow-xl p-4 flex flex-col gap-3"
      >
        <h3 className="text-[15px] font-semibold text-text-primary">{tool.name}</h3>
        <p className="text-[13px] text-text-secondary">{tool.info.howTo}</p>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Parameters</span>
          {tool.info.params.map((p) => (
            <div key={p.name} className="text-[13px]">
              <span className="font-medium text-text-primary">{p.name}</span>
              <span className="text-text-secondary"> : {p.description}</span>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
```

(Removed `OverlayBackdrop` and the manual absolute panel; Sheet provides both. Removed the inner X — the desktop popover no longer needs it since scrim closes it, and mobile Sheet supplies its own; if the existing test asserts on a Close button, keep a small desktop close affordance or update the test.)

- [ ] **Step 4:** Run `npm test -- --run src/components/planner/ToolInfoButton.test.tsx` → PASS (update any obsolete assertions about the old `OverlayBackdrop`/X).
- [ ] **Step 5:** Commit.

```bash
git add src/components/planner/ToolInfoButton.tsx src/components/planner/ToolInfoButton.test.tsx
git commit -m "feat(mobile): ToolInfoButton uses Sheet (popover on desktop, sheet on mobile)"
```

---

### Task 12: Migrate `ToolSwitcher` and `ThemeSelector`

Same popover pattern. `ToolSwitcher`'s trigger is the title button; keep its grouped menu content as children. `ThemeSelector` — read its current trigger/menu and apply the same transform.

**Files:**
- Modify: `src/components/planner/ToolSwitcher.tsx`, `src/components/theme/ThemeSelector.tsx`
- Test: create `src/components/planner/ToolSwitcher.test.tsx` (smoke) if absent; `ThemeSelector` smoke test if absent.

- [ ] **Step 1:** Write smoke tests: clicking the trigger opens `sheet-panel`; a menu item navigates/selects; scrim closes. Run → FAIL.
- [ ] **Step 2:** Migrate `ToolSwitcher`: add `const btnRef = useRef<HTMLButtonElement>(null)`, put it on the title `<button>`, replace the `{open && (<div role="menu" className="absolute ...">…</div>)}` block with `<Sheet open={open} onClose={() => setOpen(false)} desktop="popover" anchorRef={btnRef} ariaLabel="Switch tool" panelClassName="w-72 max-w-[calc(100vw-1rem)] themed-menu rounded-lg shadow-xl p-2 flex flex-col gap-1">…menu content…</Sheet>`. Delete the manual `useEffect` outside-click/Escape listener (lines 17–31). Keep `navigate` on item click.
- [ ] **Step 3:** Apply the same transform to `ThemeSelector`.
- [ ] **Step 4:** Run `npm test -- --run src/components/planner/ToolSwitcher.test.tsx src/components/theme` → PASS.
- [ ] **Step 5:** Commit.

```bash
git add src/components/planner/ToolSwitcher.tsx src/components/theme/ThemeSelector.tsx src/components/planner/ToolSwitcher.test.tsx src/components/theme/ThemeSelector.test.tsx
git commit -m "feat(mobile): ToolSwitcher and ThemeSelector use Sheet"
```

---

### Task 13: Migrate `ThemedSelect` to a mobile sheet

Desktop keeps the existing anchored listbox (already width-constrained via `left-0 right-0` + `menuPlacement`). Mobile renders the options in a `Sheet`. Branch on `useIsDesktop()`.

**Files:**
- Modify: `src/components/ui/ThemedSelect.tsx`
- Test: `src/components/ui/ThemedSelect.test.tsx` (exists — extend)

**Interfaces:**
- Consumes: `useIsDesktop` (Task 1), `Sheet` (Task 4).

- [ ] **Step 1: Extend the test**

Preserve all existing desktop keyboard-nav tests. Add:

```tsx
import { setMatchMedia } from '../../test-utils/matchMedia'
it('opens options in a sheet on mobile and commits a selection', () => {
  setMatchMedia(false)
  const onChange = vi.fn()
  const { getByRole, getByText, getByTestId } = render(
    <ThemedSelect value="a" onChange={onChange} options={[{value:'a',label:'Alpha'},{value:'b',label:'Beta'}]} />
  )
  fireEvent.click(getByRole('button'))
  expect(getByTestId('sheet-panel')).toBeInTheDocument()
  fireEvent.click(getByText('Beta'))
  expect(onChange).toHaveBeenCalledWith('b')
})
```

- [ ] **Step 2:** Run `npm test -- --run src/components/ui/ThemedSelect.test.tsx` → FAIL on the mobile test.
- [ ] **Step 3: Migrate**

Add `import { useIsDesktop } from '../../hooks/useMediaQuery'` and `import { Sheet } from './Sheet'`. Add `const isDesktop = useIsDesktop()`. Keep the trigger button. Replace the `{open && (<div role="listbox" className="absolute ...">…</div>)}` block with:

```tsx
{open && isDesktop && (
  /* existing anchored listbox unchanged */
  <div role="listbox" style={{ maxHeight: placement.maxHeight }} className={`absolute left-0 right-0 ...`}>
    {/* existing option buttons */}
  </div>
)}
{!isDesktop && (
  <Sheet open={open} onClose={() => setOpen(false)} desktop="modal" ariaLabel="Select an option"
         panelClassName="w-full">
    <div role="listbox" className="flex flex-col">
      {options.map((o) => (
        <button key={o.value} type="button" role="option" aria-selected={o.value === value}
          onClick={() => commit(o.value)}
          className={`flex items-center justify-between gap-2 px-3 py-3 text-left text-[15px] rounded ${o.value === value ? 'text-accent' : 'text-text-primary'}`}>
          <span className="truncate">{o.label}</span>
          {o.value === value && <Check className="w-4 h-4 shrink-0" />}
        </button>
      ))}
    </div>
  </Sheet>
)}
```

(Mobile rows use `py-3` for ≥44px targets. Keep desktop `menuPlacement`, keyboard handlers, and outside-click for the desktop branch.)

- [ ] **Step 4:** Run `npm test -- --run src/components/ui/ThemedSelect.test.tsx` → PASS.
- [ ] **Step 5:** Commit.

```bash
git add src/components/ui/ThemedSelect.tsx src/components/ui/ThemedSelect.test.tsx
git commit -m "feat(mobile): ThemedSelect opens as a bottom sheet on mobile"
```

---

### Task 14: Migrate `ThemedDatePicker` to a mobile sheet

Same branch approach. Desktop keeps the anchored calendar but clamp its width so it can't overflow: change `w-64` → `w-64 max-w-[calc(100vw-1rem)]`. Mobile renders the same month grid inside a `Sheet`.

**Files:**
- Modify: `src/components/ui/ThemedDatePicker.tsx`
- Test: `src/components/ui/ThemedDatePicker.test.tsx` (exists — extend)

- [ ] **Step 1:** Add a mobile test: `setMatchMedia(false)`; open → `sheet-panel` shows the month grid; clicking a day calls `onChange` with an ISO date and closes.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Migrate.** Extract the calendar body (header nav + `role="grid"` block, lines 62–94) into a local `const calendar = (…)`. Render:
  - desktop: `{open && isDesktop && (<div className="absolute left-0 top-full mt-1 z-40 w-64 max-w-[calc(100vw-1rem)] themed-menu ...">{calendar}</div>)}`
  - mobile: `{!isDesktop && (<Sheet open={open} onClose={() => setOpen(false)} desktop="modal" ariaLabel="Pick a date" panelClassName="w-full">{calendar}</Sheet>)}`
  Keep outside-click for desktop only; add `import { useIsDesktop } from '../../hooks/useMediaQuery'` and `import { Sheet } from './Sheet'`.
- [ ] **Step 4:** Run `npm test -- --run src/components/ui/ThemedDatePicker.test.tsx` → PASS. Then full run: `npm test -- --run` and `npm run build` → clean.
- [ ] **Step 5:** Commit.

```bash
git add src/components/ui/ThemedDatePicker.tsx src/components/ui/ThemedDatePicker.test.tsx
git commit -m "feat(mobile): ThemedDatePicker opens as a bottom sheet on mobile; clamp desktop width"
```

---

## PHASE 4 — Data density: tables → cards + debt fix

### Task 15: `ActualTable` mobile card layout

Show the existing table at `md:+`; render a stacked card list below `md`, with the same values.

**Files:**
- Modify: `src/components/investments/ActualTable.tsx`
- Test: create `src/components/investments/ActualTable.test.tsx`

**Interfaces:**
- Consumes: nothing new (pure presentational). Uses existing `actualRow`, `formatMoney`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ActualTable } from './ActualTable'
// Build a minimal analysis with one position that has lots, and a priceFor stub.
// Assert the ticker and a formatted value render, and that a mobile card container exists.
```

Assert: `container.querySelector('[data-testid="actual-cards"]')` exists and contains the ticker text; the `<table>` also exists (desktop). (Both render in jsdom; visibility is controlled by `md:` classes.)

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Wrap the existing `<div className="overflow-x-auto ...">` table in `<div className="hidden md:block overflow-x-auto rounded-lg border border-border">…table…</div>` and add a sibling mobile list:

```tsx
<div data-testid="actual-cards" className="md:hidden flex flex-col gap-3">
  {rows.map((r) => (
    <div key={r.positionId} className="themed-card rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold text-text-primary">{r.ticker}</span>
        <span className={`text-[14px] font-semibold tabular-nums ${r.returnDollars < 0 ? 'text-error' : 'text-accent'}`}>
          {formatMoney(r.returnDollars)} ({r.returnPct === null ? 'n/a' : `${r.returnPct.toFixed(2)}%`})
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        <span className="text-text-secondary">Initial</span><span className="text-right tabular-nums">{formatMoney(r.initialInvestment)}</span>
        <span className="text-text-secondary">Extra</span><span className="text-right tabular-nums">{formatMoney(r.extra)}</span>
        <span className="text-text-secondary">Start / Avg</span><span className="text-right tabular-nums">{formatMoney(r.startPrice)} / {r.avgPrice === null ? 'n/a' : formatMoney(r.avgPrice)}</span>
        <span className="text-text-secondary">Shares</span><span className="text-right tabular-nums">{r.shares.toFixed(2)}</span>
        <span className="text-text-secondary">Current / Value</span><span className="text-right tabular-nums">{formatMoney(r.currentPrice)} / {formatMoney(r.currentValue)}</span>
      </div>
    </div>
  ))}
</div>
```

Wrap both in a fragment.

- [ ] **Step 4:** Run `npm test -- --run src/components/investments/ActualTable.test.tsx` → PASS.
- [ ] **Step 5:** Commit.

```bash
git add src/components/investments/ActualTable.tsx src/components/investments/ActualTable.test.tsx
git commit -m "feat(mobile): ActualTable renders as cards below md"
```

---

### Task 16: `PlanTable` and `PortfolioView` mobile card layouts

Read each file's columns; apply the same `hidden md:block` table + `md:hidden` card-list pattern from Task 15, mapping each row's primary identifier + key figures into a card. Keep desktop tables unchanged.

**Files:**
- Modify: `src/components/investments/PlanTable.tsx`, `src/components/investments/PortfolioView.tsx`
- Test: create/extend `src/components/investments/PlanTable.test.tsx`, `PortfolioView` test (smoke: mobile card container renders a known row value).

- [ ] **Step 1:** Write smoke tests asserting a `data-testid="…-cards"` container renders a representative value. Run → FAIL.
- [ ] **Step 2:** Implement card lists mirroring Task 15 (primary label top, key figures in a 2-col grid). `PortfolioView` may contain multiple tables/sections — apply per table.
- [ ] **Step 3:** Run `npm test -- --run src/components/investments` → PASS.
- [ ] **Step 4:** Commit.

```bash
git add src/components/investments/PlanTable.tsx src/components/investments/PortfolioView.tsx src/components/investments/PlanTable.test.tsx src/components/investments/PortfolioView.test.tsx
git commit -m "feat(mobile): PlanTable and PortfolioView render as cards below md"
```

---

### Task 17: `TransactionListWidget` mobile card layout

**Files:**
- Modify: `src/components/budget/TransactionListWidget.tsx`
- Test: `src/components/budget/TransactionListWidget.test.tsx` (exists — extend)

- [ ] **Step 1:** Read the widget's table columns (date, description, category, amount, actions). Add a mobile test: a `data-testid="transactions-cards"` container renders a known transaction's description and amount; row actions (edit/delete) remain reachable on mobile.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: keep the `<table>` in `hidden md:block`; add `md:hidden` card list. Each card: description + amount on the top row (amount `tabular-nums`, colored by sign per existing convention), date + category on a muted second row, and the existing edit/delete controls in the card (right-aligned, ≥44px targets). Preserve existing click-to-edit behavior and any test hooks.
- [ ] **Step 4:** Run `npm test -- --run src/components/budget/TransactionListWidget.test.tsx` → PASS.
- [ ] **Step 5:** Commit.

```bash
git add src/components/budget/TransactionListWidget.tsx src/components/budget/TransactionListWidget.test.tsx
git commit -m "feat(mobile): TransactionListWidget renders as cards below md"
```

---

### Task 18: Fix `DebtPayoffCalculator` mobile stacking

Move each debt's remove button into a card header (mobile), so it no longer lands between fields. Desktop grid layout unchanged.

**Files:**
- Modify: `src/components/planner/DebtPayoffCalculator.tsx` (debt row at lines 87–145)
- Test: create `src/components/planner/DebtPayoffCalculator.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, within } from '@testing-library/react'
import { DebtPayoffCalculator } from './DebtPayoffCalculator'

describe('DebtPayoffCalculator debt card', () => {
  it('renders a mobile header row containing the remove button before the fields', () => {
    const { getAllByTestId } = render(<DebtPayoffCalculator />)
    const header = getAllByTestId('debt-card-header')[0]
    expect(within(header).getByLabelText(/Remove/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Restructure each debt block: add a header row that shows the debt name and the remove button on mobile (`md:hidden` for the header; keep the existing in-grid trash button as `hidden md:flex` so desktop is unchanged). Replace the debt block (lines 90–119 region) so the mapped debt renders:

```tsx
<div key={d.id} className="flex flex-col gap-3 border-b border-border pb-3 last:border-b-0">
  {/* Mobile-only header with name + remove */}
  <div data-testid="debt-card-header" className="flex items-center justify-between md:hidden">
    <span className="text-[14px] font-medium text-text-primary">{d.name || 'Debt'}</span>
    <button
      onClick={() => saveDebts(debts.filter((x) => x.id !== d.id))}
      className="p-2 rounded-lg text-text-secondary hover:text-error transition-colors"
      aria-label={`Remove ${d.name}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1fr_1fr_auto] gap-3 items-end">
    {/* Name, SelectField(Type), Balance, APR — unchanged */}
    {/* Desktop-only trash (unchanged position), hidden on mobile: */}
    <button
      onClick={() => saveDebts(debts.filter((x) => x.id !== d.id))}
      className="hidden md:flex self-end p-2 mb-2 rounded-lg text-text-secondary hover:text-error transition-colors"
      aria-label={`Remove ${d.name}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
  {/* second grid (payment inputs) — unchanged */}
</div>
```

- [ ] **Step 4:** Run `npm test -- --run src/components/planner/DebtPayoffCalculator.test.tsx` → PASS. Full run + build → clean.
- [ ] **Step 5:** Commit.

```bash
git add src/components/planner/DebtPayoffCalculator.tsx src/components/planner/DebtPayoffCalculator.test.tsx
git commit -m "fix(mobile): move debt remove button into a card header on mobile"
```

---

## PHASE 5 — Layout: nav safe-area + overflow backstop

### Task 19: Fix bottom-nav cutoff and horizontal-overflow backstop

**Files:**
- Modify: `src/components/Layout.tsx` (`<main>` at line 116; tab bar at 141–163)
- Test: `src/components/Layout.test.tsx` (create if absent — assert `<main>` uses the safe-area padding and `overflow-x` guard classes)

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Layout } from './Layout'

describe('Layout mobile chrome', () => {
  it('reserves safe-area-aware space above the tab bar and guards horizontal overflow', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const main = container.querySelector('main')!
    // padding reserves tab bar height + safe area on mobile:
    expect(main.className).toMatch(/pb-\[/) // custom bottom padding present
    expect(main.className).toMatch(/overflow-x-hidden|overflow-x-clip/)
  })
})
```

- [ ] **Step 2:** Run `npm test -- --run src/components/Layout.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** In `Layout.tsx`:
  - Change `<main className="flex-1 min-w-0 overflow-auto p-4 sm:p-8 pb-24 md:pb-8 relative z-10">` to reserve the tab bar height (52px) + safe-area inset on mobile and guard horizontal scroll:

```tsx
<main
  className="flex-1 min-w-0 overflow-auto overflow-x-hidden p-4 sm:p-8 md:pb-8 relative z-10 pb-[calc(52px+env(safe-area-inset-bottom)+16px)] md:pb-8"
>
```

  (The `pb-[calc(...)]` reserves 52px tab bar + safe-area inset + 16px breathing room on mobile; `md:pb-8` restores desktop. `overflow-x-hidden` is the page-level backstop so no stray absolute child can produce a sideways scrollbar. Note: with `Sheet` now portaled to `document.body`, popovers are no longer clipped by this.)

- [ ] **Step 4:** Run `npm test -- --run src/components/Layout.test.tsx` → PASS.
- [ ] **Step 5:** Commit.

```bash
git add src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "fix(mobile): reserve safe-area space above tab bar; guard horizontal overflow"
```

---

### Task 20: Full regression, build, and in-app verification

**Files:** none (verification only).

- [ ] **Step 1: Full test + build**

Run: `npm test -- --run` → Expected: all PASS.
Run: `npm run lint` → Expected: clean (fix any new warnings introduced).
Run: `npm run build` → Expected: clean (tsc + vite).

- [ ] **Step 2: Manual in-app verification (mobile viewport)**

Start the dev server via the browser-preview tooling and set the viewport to 375×812. Walk the checklist from the spec's "Verification" section:
- Open each migrated modal/popover: the background does **not** scroll; dismiss via swipe-down, scrim tap, X, and Escape.
- Planner: opening the tool switcher, tool info, a `ThemedSelect`, and the date picker produces **no** horizontal scrollbar.
- Scroll each page (Dashboard, Budget, Investments, Planner, Compensation) to the bottom: the last card fully clears the tab bar.
- Debts: the remove button sits in each debt's header, not between fields.
- Investments analysis / portfolio / transactions: dense data reads as cards with no sideways table scroll.

- [ ] **Step 3: Desktop regression spot-check (≥768px)**

Resize to 1280×800: confirm every migrated modal is centered and styled as before, popovers anchor to their triggers, tables render as tables, and the debt row layout is unchanged.

- [ ] **Step 4: Capture proof**

Take before/after-style screenshots at mobile and desktop widths for the PR description.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(mobile): regression fixes from full verification pass"
```

---

## Self-Review notes (author → executor)

- **Spec coverage:** scroll lock (Tasks 2,4) → all overlays; horizontal overflow (Tasks 4 popover clamp, 13/14 width clamp, 19 backstop); nav cutoff (Task 19); grid-collapse (Task 18); tables → cards (Tasks 15–17); modals → sheets (Tasks 5–10); popovers/form controls → sheets (Tasks 11–14); reduced-motion + focus + a11y (Task 4). All spec sections map to a task.
- **Type consistency:** `Sheet` prop names (`open`, `onClose`, `desktop`, `anchorRef`, `dismissible`, `ariaLabel`, `panelClassName`) are used identically in every consumer task. `shouldDismissOnDragEnd(offsetY, velocityY)` signature matches its use in `Sheet.onDragEnd`. `useIsDesktop()`/`useScrollLock(active)` signatures match.
- **Watch item for the executor:** framer-motion `AnimatePresence` exit animations can emit React `act()` warnings in tests; assert on presence and close callbacks (as the provided tests do), not on exit timing. If `drag` props cause issues in any environment, the dismissal logic is already covered by the pure `shouldDismissOnDragEnd` unit test (Task 3).
- **Order dependency:** Phase 0 → 1 must land before any consumer phase (2–5). Within Phase 2–4, tasks are independent and can be parallelized across subagents, but each assumes `Sheet`/hooks exist.
