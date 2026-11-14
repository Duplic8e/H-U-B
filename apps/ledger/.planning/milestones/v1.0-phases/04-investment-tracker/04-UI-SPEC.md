---
phase: 4
slug: investment-tracker
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-18
---

# Phase 4 — UI Design Contract

> Visual and interaction contract for frontend phases.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | lucide-react |
| Font | Roboto/Inter (from Phase 1) |

---

## Spacing Scale

Declaring values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 500 | 1.2 |
| Heading | 18px | 600 | 1.2 |
| Display | 24px | 700 | 1.1 |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | var(--bg-primary) | Background, surfaces |
| Secondary (30%) | var(--bg-secondary) | Cards, sidebar, nav |
| Accent (10%) | var(--color-primary) | Chart lines, primary buttons |
| Destructive | var(--color-destructive) | Destructive actions only |

Accent reserved for: Primary data lines in charts, primary action buttons.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Set Target Goal |
| Empty state heading | No investment data yet. |
| Empty state body | Add your first investment target to start tracking. |
| Error state | Could not load chart. Refresh the page to try again. |
| Destructive confirmation | Reset: Are you sure you want to clear your investment data? |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-18
