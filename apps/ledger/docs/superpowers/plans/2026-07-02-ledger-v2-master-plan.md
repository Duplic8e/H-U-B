# Ledger v2.0 — Master Implementation Plan

> **For agentic workers (Fable 5):** This is the ORCHESTRATION plan for the whole v2.0 milestone. You do NOT execute tasks directly from this file. You execute **one phase at a time**, each via its own detailed plan, using **superpowers:subagent-driven-development**. Read the "How you work" and "Resume protocol" sections before doing anything.

**Goal:** Take Ledger from v1.0 to v2.0 — real Investments + Planner modules, live market data (within the zero-infra model), installable/mobile PWA, JSON backup, and a 2026 UI/UX pass.

**Source spec:** [docs/superpowers/specs/2026-07-02-ledger-v2-design.md](../specs/2026-07-02-ledger-v2-design.md) — the authority on WHAT to build. This file governs HOW to execute it.

**Tech stack:** React 19, Vite, Tailwind v4, Zustand (`persist`), Recharts, PapaParse, Framer Motion, vite-plugin-pwa, Vitest + Testing Library. Deployed static to GitHub Pages.

---

## How you work (read once, follow every phase)

You are executing a large milestone across many sessions. Be **token- and context-efficient**:

1. **One phase at a time, in order.** Never load more than the current phase into context. The phase order and dependencies are fixed (see "Phase order" below).
2. **Plan each phase just-in-time — with a strong-model planning subagent.** Phase 1 already has a detailed plan (`2026-07-02-phase-1-foundation.md`). For every later phase, BEFORE executing it, **dispatch a fresh subagent to write the plan** (via the Agent tool). Instruct that subagent to invoke **superpowers:writing-plans** and produce `docs/superpowers/plans/2026-07-02-phase-<N>-<name>.md` from the matching spec section, planning against the *current* codebase (it will have changed since v1.0). Give the subagent: the spec path, this master plan's Global Constraints, and the phase's spec section. When it returns the saved plan path, review it briefly, then execute it. Rationale: planning quality gates everything downstream, so spend the stronger model on the plan; keep the lighter execution model for the task-by-task subagents in step 3.
3. **Execute with subagent-driven-development.** Use **superpowers:subagent-driven-development**: dispatch a fresh subagent per task, review between tasks. This keeps YOUR context small — the subagent holds the task detail, you hold only the plan checklist and review results. This is the primary token-efficiency mechanism. Do NOT execute every task inline in your own context.
4. **TDD, always.** Every task: write the failing test → confirm it fails → minimal implementation → confirm it passes → commit. Use Vitest (`npm test`). Follow the existing co-located `*.test.tsx` / `*.test.ts` pattern.
5. **Commit after every task.** Small, frequent commits. This is also what makes resuming safe.
6. **Update PROGRESS.md after every task and every phase.** See resume protocol. This is non-negotiable — it is the only thing that lets the user say "continue" hours later.

## Resume protocol (how "continue" works)

The user may run out of tokens for hours, then return and say only **"continue."** When that happens:

1. **Read [PROGRESS.md](PROGRESS.md) first, before anything else.** It records the current phase, whether that phase has a detailed plan yet, the last completed task, and the next task.
2. **Verify against git:** run `git log --oneline -15` to confirm the last commit matches PROGRESS.md's "last completed task." If they disagree, trust git and reconcile PROGRESS.md.
3. **Resume at the next unchecked task** in the current phase's detailed plan. If the current phase has no detailed plan yet, plan it (step 2 of "How you work"), then start its first task.
4. **Never redo completed work.** Completed tasks have `- [x]` in their phase plan and a matching commit.

You must keep PROGRESS.md accurate at all times — update it in the same commit as the task, or immediately after. Treat a stale PROGRESS.md as a bug.

## Phase order (fixed — each depends on the ones before)

| # | Phase | Detailed plan | Spec section |
|---|-------|---------------|--------------|
| 1 | Foundation: Save + PWA + Mobile base | `2026-07-02-phase-1-foundation.md` (written) | Phase 1 |
| 2 | Market Data Service | plan JIT | Phase 2 |
| 3 | Compensation: live price + CAD toggle | plan JIT | Phase 3 |
| 4 | Planner (tools/calculators hub) | plan JIT | Phase 4 |
| 5a | Investments: Plan vs Actual (decision journal) | plan JIT | Phase 5a |
| 5b | Investments: Portfolio Viewer (CSV import) | plan JIT | Phase 5b |
| 6 | Budgeting enhancements | plan JIT | Phase 6 |
| 7 | UI/UX 2026 refresh + Dashboard polish | plan JIT | Phase 7 |

**Phase 4 is large** (11+ calculators). When you plan it JIT, split it into sub-plans if it exceeds ~12 tasks — one working calculator (or a small group) per sub-plan, the FIRE forecaster as its own sub-plan.

## Global Constraints (apply to EVERY task in EVERY phase)

Copied verbatim from the spec — every task's requirements implicitly include these:

- **Zero backend / zero-infra.** Static SPA on GitHub Pages. No server, no auth, no database. Everything client-side.
- **Local-first persistence.** Every new store uses Zustand `persist` → LocalStorage, following the pattern in `src/store/useCompensationStore.ts`.
- **Backup coverage.** Every persisted store MUST be included in the Phase 1 JSON backup export/import (when you add a store in a later phase, wire it into the backup registry).
- **Bento architecture.** Widget cards are layout wrappers taking `children`; layout stays decoupled from widget logic. New widgets follow this (see `src/components/dashboard/WidgetWrapper.tsx`, `BentoGrid.tsx`).
- **Recharts only** for charts (SVG + CSS-variable theming).
- **Dual themes are sacred.** Every new view works in BOTH themes (Tactical Monospace + Geometric Abstraction). **No hardcoded colors — use theme CSS variables only.**
- **CSV reuse.** All CSV parsing reuses the PapaParse + bank-specific-parser + generic-column-mapper pattern in `src/utils/csvParser.ts`.
- **Live data always has a manual fallback.** Market-data features must remain fully usable offline via cache + manual override.
- **Mobile + both themes are acceptance gates.** Every new view must render correctly on a phone and in both themes before its phase is "done."

## Definition of done (per phase)

A phase is done when: all its tasks are `- [x]`, `npm test` passes, `npm run build` succeeds, `npm run lint` is clean, PROGRESS.md is updated, and the phase's spec "Done when" criterion is met. Then move to the next phase.

---

## Starting instructions for Fable 5

1. Read this file and [PROGRESS.md](PROGRESS.md).
2. If PROGRESS.md shows a fresh start: begin Phase 1 using `2026-07-02-phase-1-foundation.md` via superpowers:subagent-driven-development.
3. Otherwise: follow the Resume protocol.
