# v0.6.1-beta: Settings sheet + sidebar redesign

**Date:** 2026-07-16
**Scope:** Visual/organizational redesign of the Settings sheet (gear popup) and desktop sidebar. No new features, no data-model changes. Ships as `0.6.1-beta`.

## Problem

The Settings sheet is one undifferentiated scroll: a 5-card theme grid, an always-expanded API-key form with a permanent 3-step tutorial, a centered Backup row (everything else is left-aligned), and two bare text links for About. The sidebar wastes its header on a tagline, hides the ⌘K command palette entirely, and its settings dock is centered and stacked.

## Design

### 1. Settings sheet — grouped cards (Option A)

`SettingsSheet.tsx` renders four bordered section cards inside the existing `Sheet` (modal on desktop, bottom sheet on mobile — unchanged). Each card: `border border-border rounded-lg p-3`, with a header row of a small lucide icon + 13px medium title, replacing the current bare uppercase `SectionHeading`.

**Appearance card** — theme picker upgraded to "mini app preview" tiles (see §2).

**Market data card** (`MarketDataSettings.tsx`):
- Header row gets a status badge on the right: green pill `Key active …abc` when a key is saved, muted pill `No key` otherwise. Replaces the current status sentence.
- Input + Save on one row (input flex-1, Save button beside it). Input placeholder: `Paste API key…` / `Replace API key…` when one exists. Remove button stays, appearing only when a key exists.
- The 3-step "how to get a key" instructions collapse into a native `<details>` disclosure — summary text `How to get a free key` in accent color with chevron. Collapsed by default; content is the existing ordered list, unchanged.
- "Stored only on this device" caption stays, below the disclosure.

**Backup card** (`BackupControls.tsx`):
- Two equal-width (`flex-1`), left-aligned bordered buttons: `Export data` / `Import backup`, replacing the centered ghost pair. Error line unchanged.

**About footer** — no card; a single row under a top hairline: left `v{version} · What's New` button, right `Not financial advice` button (opens disclaimer). Same handlers as today.

### 2. Theme picker — mini app previews

`ThemeSwatchGrid.tsx` tiles become tiny caricatures of the app, per theme, using each theme's real bg/accent hexes (already in `SWATCHES`):

- Tile bg = theme `bg` hex, rounded-lg, p-2.
- Row 1: a 14px square "logo chip" (accent at ~13% opacity + 1px accent border) beside a muted header bar (slightly lighter/darker than bg).
- Row 2: an inline SVG sparkline (~16px tall, `stroke` = accent, unique-ish points per tile are fine but a shared polyline is acceptable).
- Row 3: theme name (12px) + Check icon when active, as today.
- Selection ring: active tile `border-[1.5px] border-accent` (theme's own accent hex), inactive `border-border hover:border-accent/50`.
- Radiogroup semantics, keyboard focus ring, and store wiring unchanged. Each tile needs a `headerBg` hex added to `SWATCHES` (a neutral derived from the theme bg).

### 3. Sidebar — refined (Option 1)

`Layout.tsx`, desktop `<nav>` only; mobile bottom tab bar untouched.

- Remove the `Command Center` tagline; header is just `Ledger`.
- Below the header, a Search affordance: bordered button with search icon, `Search` label, and a right-aligned `⌘K` kbd chip. Clicking sets `paletteOpen(true)`. (Label can show `Ctrl K` on non-Mac if trivially detectable via `navigator.platform`; otherwise `⌘K` is acceptable.)
- Active nav item gains a 2px left accent bar (`border-l-2 border-accent`, left corners squared) in addition to the existing `bg-accent/10 text-accent`.
- Settings dock becomes one row: left-aligned `Settings` button (icon + label), right-aligned muted `v{version}` text button that opens What's New. Remove `items-center` stacking.

## Error handling

No new error paths. Backup import error display and API-key save/remove flows are behavior-identical.

## Testing

- Existing tests must pass (`MarketDataSettings.test.tsx` may need selector updates for the badge/placeholder changes).
- New/updated component tests: disclosure collapsed by default and toggles; key-status badge reflects store state; Export/Import buttons render; sidebar search button opens the command palette; active nav item has `aria-current="page"`.
- Manual verify in browser: all five themes render legible preview tiles; sheet fits without scrolling on desktop at default content; mobile bottom-sheet behavior unchanged.

## Release

- Bump version to `0.6.1-beta` (package.json + changelog entry: settings redesign, theme preview tiles, sidebar refinements, ⌘K discoverability).
- Commit style: `feat(settings)` / `feat(nav)` / `chore: release v0.6.1-beta`.

## Out of scope

Collapsible sidebar rail (0.7 candidate), tabbed settings, drill-in settings views, wheel-tab follow-ups from v0.6 review, focus-chaining fix for Settings→About (tracked separately).
