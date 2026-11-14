# Financial Dashboard Web App

## What This Is

A highly scalable, cross-platform financial dashboard web app (PWA) that gives users deep, actionable insights into their financial health across net worth, budgeting (with CSV import, smart triage, dynamic rules engine, and flexible paradigms), investments, future projections, and total compensation. It features a strict modular architecture with a high-density Bento Grid layout and an unapologetically premium dual-theme system (Tactical Monospace and Geometric Abstraction). Shipped as v1.0 MVP — local-first, no backend.

## Core Value

A striking, uncompromising user experience that makes managing personal wealth feel like operating a premium engineering command center.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Global Navigation for module switching and theme toggling — v1.0
- ✓ Dual-theme system (Tactical Monospace vs. Geometric Abstraction) via Tailwind CSS — v1.0
- ✓ High-density Bento Grid layout with strictly self-contained component wrappers — v1.0
- ✓ Master Dashboard (Net Worth) view — v1.0
- ✓ Budgeting Module for cash flow, income, and categorized expenses — v1.0
- ✓ "Investment Plan vs. Actual" Tracker (Recharts) — v1.0
- ✓ Future Projections visualization tool (compounding/savings) — v1.0
- ✓ Total Compensation Calculator (base, bonus, RSU/Options vesting, time-based modes) — v1.0
- ✓ CSV Import with bank-specific parsers and generic column mapper — v1.0
- ✓ Smart Triage Inbox with approve/reject transaction flow — v1.0
- ✓ Dynamic categorization Rules Engine with full CRUD UI — v1.0
- ✓ Flexible Budgeting Paradigms (Target-Based, Zero-Based, Ledger Custom) with Effective Targets math — v1.0

### Active

<!-- Current scope. Building toward these — next milestone. -->

(None yet — define with `/gsd-new-milestone`)
### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- [Live Bank Sync (e.g., Plaid)] — Deferred beyond v1 to focus on local-first PWA and core layout foundations.
- [Complex Backend Database] — Vite SPA + LocalStorage chosen for a fast, client-side PWA architecture.
- [User authentication & cloud sync] — Deferred to v2; local-first remains the v1 priority.

## Context

- **Shipped:** v1.0 MVP on 2026-07-01 — 9 phases, 14 plans, ~5,200 LOC TypeScript/React across 2 weeks.
- **Tech stack (as built):** React + Vite SPA, Tailwind CSS, Framer Motion, Zustand (with persist middleware), React Router, Recharts, PapaParse, vite-plugin-pwa. Deployed via GitHub Actions to GitHub Pages.
- The app acts as a PWA with local-first persistence (LocalStorage / Zustand persist).
- UI aesthetic is paramount: strictly no generic Bootstrap-style templates. The design language impresses power users with high-contrast, strictly structured aesthetics.
- Architecture relies on a component-based model where widget cards accept only children, decoupling layout from widget logic entirely.
- **Known state:** All core modules are functional and verified. Investments and Projections pages carry "coming soon" notices for future enhancements.

## Constraints

- **Tech Stack**: React (Vite SPA), Tailwind CSS, Framer Motion — Ensures rapid client-side performance, fluid animations, and easy theme switching.
- **State Management**: Zustand or React Context — For managing global financial data locally.
- **Data Visualization**: Recharts — Selected over Chart.js because SVG-based rendering natively supports Tailwind CSS variables for seamless real-time theme swapping.
- **Design Layout**: High-density Bento Grid — Row-based equal-sized cards are forbidden to avoid the "generic template" look.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vite + LocalStorage | Prioritize local-first, blazing-fast PWA performance over immediate server/database complexity. | ✓ Good — shipped v1.0, no backend needed for MVP |
| Manual Data Entry | Focus on building core UI/UX features and charting logic before tackling 3rd-party financial APIs like Plaid. | ✓ Good — kept v1.0 scope tight |
| Recharts for Charts | SVG-based charts support CSS variables natively, enabling instant, redraw-free theme transitions between Dark/Light modes. | ✓ Good — used across Investment, Projection, Equity widgets |
| Bento Grid Component Architecture | Cards act only as layout wrappers taking `children`, enabling easy drag-and-drop or 1-line swaps in the layout map. | ✓ Good — clean widget composition throughout |
| Zustand persist middleware | Persist financial state across sessions without a backend. | ✓ Good — local-first state for all modules (v1.0) |
| GitHub Actions → GitHub Pages | Ship the PWA with zero-infra static hosting. | ✓ Good — deploy pipeline live (v1.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-01 after v1.0 milestone completion (Phases 1-9)*
