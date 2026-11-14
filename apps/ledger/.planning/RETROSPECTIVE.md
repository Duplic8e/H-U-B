# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-19
**Phases:** 6 | **Plans:** 11

### What Was Built
- Dual-theme PWA shell (Tactical Monospace / Geometric Abstraction) with global navigation and Bento Grid layout.
- Master Dashboard with Net Worth, assets, and debts widgets backed by Zustand.
- Budgeting Module — income, categorized expense, and cash-flow tracking with a transaction modal.
- Investment Tracker and Future Projections built on theme-reactive Recharts.
- Total Compensation Calculator — base/bonus/benefits, RSU/Options vesting, time-based modes, and offer comparison.
- GitHub Actions → GitHub Pages deployment pipeline.

### What Worked
- The `children`-only Bento Grid wrapper kept layout fully decoupled from widget logic — widgets dropped in cleanly across all six phases.
- Recharts + Tailwind CSS variables delivered instant, redraw-free theme transitions exactly as the architecture decision predicted.
- Zustand + persist gave local-first state across every module with no backend overhead.
- Tight, verified phases: every requirement traced to a phase, and UAT/VERIFICATION/security all passed before close.

### What Was Inefficient
- Phase 6 needed a gap-closure plan (06-04) after UAT found the offer-compare RSU row showed $0 — the equity input was missing from the compare form. Caught in UAT, not planning.
- REQUIREMENTS.md checkboxes were never ticked during execution; traceability was reconstructed at milestone close rather than maintained per-phase.
- Worktree execution lost `node_modules` (required `npm ci`), briefly blocking 06-04.

### Patterns Established
- Children-only Bento widget wrappers as the standard layout primitive.
- Theme-reactive charts via Recharts bound to Tailwind CSS variables.
- Zustand persist as the default local-first store pattern for every module.

### Key Lessons
1. Maintain REQUIREMENTS.md traceability *during* execution, not retroactively at milestone close — stale checkboxes obscure real status.
2. Cross-form data wiring (e.g. RSU inputs in the compare flow) is a recurring gap class — validate every input surface that feeds a computed view, not just the primary entry form.
3. Worktree-isolated execution does not inherit `node_modules`; budget for `npm ci` in isolated runs.

### Cost Observations
- Model mix: not tracked this milestone.
- Notable: 6 phases / 11 plans shipped in 3 days with per-phase verification gates — fast cadence held without sacrificing the verification chain.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 11 | Established GSD phase→verify cadence; introduced gap-closure phases from UAT findings |

### Cumulative Quality

| Milestone | Requirements | Verified | Notes |
|-----------|--------------|----------|-------|
| v1.0 | 16/16 | UAT 3/3, security 8/8 accepted | First milestone — baseline |

### Top Lessons (Verified Across Milestones)

1. (Pending v1.1) — single milestone so far; trends emerge from v1.1 onward.
