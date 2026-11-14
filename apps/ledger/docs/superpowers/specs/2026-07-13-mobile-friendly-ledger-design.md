# Mobile-Friendly Ledger — Design Spec

**Date:** 2026-07-13
**Branch:** `feat/v0.5-disclaimer-marketdata` (or a dedicated `feat/mobile-friendly` branch)
**Status:** Approved design, ready for implementation planning
**Scope:** Mobile (`< md` breakpoint) only. Desktop layout is preserved; minor *positive* desktop changes are acceptable but never required.

## Problem

The desktop experience is good; the mobile experience is not. Concrete, reproducible defects reported by the user:

1. **Background scrolls behind popups.** No modal or popover freezes body scroll. Confirmed: there is no scroll-lock hook anywhere in the codebase; every modal is a hand-rolled `fixed inset-0` overlay.
2. **Horizontal scrolling from popups/dropdowns.** Anchored panels with fixed widths spill past the viewport's right edge, and `<main>` allows horizontal scroll, so the whole page gains a sideways scrollbar. Culprits: `ToolSwitcher` (`w-72`), `ToolInfoButton` (`w-[32rem]`, `left-0`), `ThemedDatePicker` (`w-64`, `left-0`). (`ThemedSelect` is already `left-0 right-0` width-constrained and does **not** overflow.)
3. **Last card is cut off by the bottom tab bar.** `<main>` reserves `pb-24` (96px), but the fixed tab bar is `min-h-[52px]` + `env(safe-area-inset-bottom)` + border, which exceeds 96px on notched phones, hiding the bottom of the last card.
4. **Controls land in the wrong place when grids collapse.** Desktop grids collapse to `grid-cols-1` on mobile in source order. In `DebtPayoffCalculator` the remove/trash button is a grid cell after APR, so stacked it appears *in the middle* of a debt's fields instead of in a header.
5. **Dense data is hard to read.** Wide tables (`ActualTable`/`PlanTable` are 10 columns) force one-column-at-a-time horizontal scrolling on mobile.

## Decisions (locked with the user)

- **Direction:** "Set 1" — reflow desktop layers into mobile **bottom sheets** and **cards**. Not a mobile-native rewrite (no FAB, no snap-scroll home hub — those concepts were shown and declined for now).
- **Sheet dismissal:** swipe-down-to-dismiss **plus** scrim-tap, close button, and `Escape`.
- **Shared components:** refactor modals/popovers through new shared primitives that render **identically on desktop**; desktop visual changes allowed only if clearly positive.
- **Form-control popovers:** `ThemedSelect` and `ThemedDatePicker` also become bottom sheets on mobile.
- **Tables:** all four (`ActualTable`, `PlanTable`, `PortfolioView`, `TransactionListWidget`) get a mobile card layout.
- **Base library:** hand-rolled on **framer-motion** (already a dependency). No new packages.
- **Theme:** existing CSS-variable tokens only. No palette or desktop-typography changes.

## Architecture

### New shared primitives (`src/components/ui/`)

**1. `useScrollLock(active: boolean)` — hook**
- When `active`, sets `document.body` to non-scrolling and compensates for the removed scrollbar width (pad `body` by the scrollbar width) to avoid layout shift on desktop.
- Reference-counted (a module-level counter) so nested/stacked overlays don't unlock prematurely; the body unlocks only when the last consumer deactivates.
- Restores prior state on cleanup. SSR-safe guard (`typeof document`).

**2. `Sheet` — the core overlay primitive**
- Props (shape to be finalized in the plan): `open`, `onClose`, `desktop` variant discriminator (`'modal' | 'popover'`), an `anchorRef` (popover only), `labelledBy`/`aria-label`, and children.
- Renders through a **React portal** to `document.body` so no `overflow`/`transform` ancestor can clip it, and calls `useScrollLock(open)`.
- **Mobile (`< md`):** a bottom sheet — dimmed scrim + a rounded-top panel pinned to the bottom, animated in with framer-motion. Dismissal: swipe-down past a threshold (drag with velocity/offset check), scrim tap, close button, `Escape`. Honors `useReducedMotion` (no slide, just fade). Respects `env(safe-area-inset-bottom)` in its padding. Focus is trapped; focus returns to the trigger on close.
- **Desktop (`≥ md`):**
  - `modal` → centered dialog matching the current modal treatment (scrim + `themed-card`), visually unchanged from today.
  - `popover` → panel anchored to `anchorRef`, width-clamped to `min(content, calc(100vw - margin))` and flipped/positioned so it can never cause horizontal overflow.
- Breakpoint is resolved with a `useMediaQuery('(min-width: 768px)')` (matches Tailwind `md`) so the correct variant mounts; avoids rendering both.

**3. Mobile card pattern for tables**
- A lightweight convention (a small `FieldCard`/`DataCard` helper or a per-table `md:hidden` card block) rather than a heavy generic table abstraction. Each table renders its existing `<table>` at `md:` and up, and a stacked list of labeled cards below `md`. Card layout surfaces the primary identifier (e.g. ticker) and P&L up top, remaining fields as label/value pairs.

### Component changes

| Area | Files | Change |
|---|---|---|
| Modals → sheets | `AnalysisModal`, `CompensationModal`, `TransactionModal`, `AddAccountModal`, `CSVUploader`, `MarketDataSettings`, `WhatsNewModal`, `DisclaimerModal`, `CommandPalette` | Route each through `Sheet` (`modal` variant). Remove hand-rolled `fixed inset-0` scaffolding; keep inner content. Gain scroll lock + mobile sheet automatically. `CommandPalette` and `DisclaimerModal` (which has `requireAck`) keep their special behaviors (e.g. non-dismissible when ack required). |
| Menu popovers → sheets | `ToolSwitcher`, `ToolInfoButton`, `ThemeSelector` | Route through `Sheet` (`popover` variant). Mobile: bottom sheet. Desktop: anchored, width-clamped. |
| Form-control popovers → sheets | `ThemedSelect`, `ThemedDatePicker` | Mobile: option list / month-grid in a bottom sheet. Desktop: unchanged anchored panel (clamp `ThemedDatePicker` so it can't overflow). Preserve keyboard nav and `menuPlacement` logic on desktop. |
| Tables → cards | `ActualTable`, `PlanTable`, `PortfolioView`, `TransactionListWidget` | Add `md:hidden` mobile card layout; keep existing table at `md:+`. |
| Stacking fix | `DebtPayoffCalculator` | Mobile: each debt is a card; name + remove button in a header row; fields in a 2-up grid below. Desktop grid layout unchanged. |
| Layout / nav / overflow | `Layout` | `<main>` bottom padding = `calc(tabbar-height + env(safe-area-inset-bottom))` on mobile so the last card clears the tab bar. Add an `overflow-x-clip`/`overflow-x-hidden` backstop so no stray element can scroll the page sideways. Verify the tab bar's own `env(safe-area-inset-bottom)` padding is retained. |

## Data flow & state

No store or data-model changes. All changes are presentational: overlay open/close state stays local to each component (as today); the only new shared state is the module-level scroll-lock reference counter inside `useScrollLock`. Existing zustand stores, services, and finance utilities are untouched.

## Isolation & boundaries

- `useScrollLock`, `Sheet`, and `useMediaQuery` are self-contained, independently testable units with narrow interfaces.
- Each consuming component depends only on `Sheet`'s public props; internal sheet/gesture logic can change without touching consumers.
- Tables adopt a shared card convention but keep their own field mappings, so no table needs to know about another.

## Error handling & edge cases

- **Stacked overlays** (e.g. a `ThemedSelect` sheet opened inside a modal sheet): scroll lock is reference-counted; z-index layering is explicit and increasing per portal; `Escape` closes only the topmost.
- **`requireAck` disclaimer:** must remain non-dismissible by scrim/swipe/Esc when acknowledgement is required.
- **Reduced motion:** framer-motion animations degrade to fades; no gesture-driven transform when `prefers-reduced-motion`.
- **Focus management:** trap focus within an open sheet; restore to the trigger on close; visible focus states preserved.
- **Keyboard on mobile web:** sheets containing inputs (forms, `ThemedSelect`) must remain usable when the on-screen keyboard reduces viewport height — sheet content scrolls internally; use dynamic viewport units (`dvh`) for max-height.
- **Very tall content** (e.g. `NewAnalysisModal` with many ticker rows): sheet max-height caps and scrolls internally; the page behind stays locked.

## Testing strategy

TDD per `superpowers:test-driven-development`. Existing suites to preserve/extend: `OverlayBackdrop.test`, `ThemedSelect.test`, `ThemedDatePicker.test`, `AnalysisModal.test`, `CompensationModal.test`, `TransactionModal.test`, plus table/widget tests.

- **`useScrollLock`:** body locks on activate, unlocks on deactivate, stays locked while any consumer is active (reference counting), restores prior state.
- **`Sheet`:** renders desktop variant vs mobile sheet per matched media query; closes on scrim tap / close button / `Escape`; swipe-down past threshold calls `onClose` (simulated pointer drag); does not close on a small drag; focus trap + restore; `requireAck`-style non-dismissible mode.
- **Consumers:** each refactored modal/popover still opens, closes, and performs its primary action; desktop rendering assertions unchanged.
- **Tables:** mobile card layout renders the same values as the desktop table for a given dataset (assert via forced narrow layout / `md:hidden` structure).
- **Regression:** full `npm test` green; `npm run build` (tsc + vite) clean.

## Verification (manual, in-app)

Using the dev server + browser preview at mobile viewport (375×812) and a notched profile:
- Open each modal/popover: background does not scroll; sheet dismisses by swipe, scrim, X, Esc.
- Planner: opening the tool switcher, tool info, and any select no longer produces a horizontal scrollbar.
- Scroll each page to the bottom: the last card fully clears the tab bar.
- Debts: remove button sits in each debt's header.
- Investment analysis, portfolio, transactions: data reads as cards, no sideways table scroll.
- Desktop viewport: spot-check that modals, popovers, and tables look and behave as before.

## Out of scope (explicitly deferred)

- Mobile-native concepts shown and declined: big-number hero, inline charts, segmented controls, snap-scroll chips, quick-action tiles, floating action button, swipe-to-delete on list items.
- Any change to desktop information architecture, navigation, or theme palette.
- New dependencies.

## Rollout

Single feature branch, phased commits (atomic per phase):
1. Primitives (`useScrollLock`, `useMediaQuery`, `Sheet`) + their tests.
2. Migrate the 9 modals.
3. Migrate the 6 popovers (menus + form controls).
4. Tables → cards + `DebtPayoffCalculator` card fix.
5. `Layout` nav/safe-area/overflow fixes + full-app manual verification + regression run.
