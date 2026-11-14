---
phase: 06-total-compensation-calculator
plan: 04
subsystem: compensation-calculator
tags: [react, zustand, rsu, offer-comparison, gap-closure]
requires:
  - "src/store/useCompensationStore.ts (RSUGrant, VestingSchedule, calcAnnualRSU, generateVestEvents)"
provides:
  - "RSU grant input UI in the compare offer form, wired into setComparePackage"
affects:
  - "src/components/compensation/CompareView.tsx"
tech-stack:
  added: []
  patterns:
    - "Reused CompensationModal Equity-tab vesting-schedule construction in CompareView local state"
key-files:
  created: []
  modified:
    - "src/components/compensation/CompareView.tsx"
decisions:
  - "Used a select dropdown for the vesting preset instead of three buttons to fit the narrow 1/3-width compare column (plan permitted either)."
  - "Restored project dependencies via `npm ci` from the committed lockfile — worktrees do not inherit node_modules; no new packages added."
metrics:
  duration: "~6 min"
  completed: "2026-06-19"
  tasks: 3
  files: 1
status: complete
---

# Phase 06 Plan 04: Compare-View RSU Input Gap Closure Summary

Wired RSU/equity grant entry into the Offer Comparison compare form so the "RSU (Annual)" comparison row reflects real entered grants instead of the hardcoded $0.

## What Changed

The compare offer form in `CompareView.tsx` previously called `setComparePackage` with a hardcoded `rsuGrants: []` (line 43), so `calcAnnualRSU(comparePackage, timeMode)` always returned $0 for the compare offer and the RSU delta was meaningless. This plan added an inline RSU grant sub-form to the compare column and routed the collected grants into the package.

- **Task 1** — Added local component state: `compareRsuGrants: RSUGrant[]` plus draft-input state (`rsuGrantName`, `rsuGrantShares`, `rsuGrantPrice`, `rsuStartDate`, `rsuPreset`, `rsuTotalMonths`, `rsuCliffMonths`, `rsuFrequency`). Added `addCompareRsuGrant()` (builds a `VestingSchedule` with identical preset→months/cliff logic to `CompensationModal.handleSaveRSU`, guards on empty name/shares/price, appends a grant with `crypto.randomUUID()`, resets name/shares for fast multi-entry) and `removeCompareRsuGrant(id)`. Added a type-only import of `RSUGrant`, `VestingSchedule`, `VestingPreset`, `VestingFrequency`.
- **Task 2** — Rendered the inline "RSU / Equity Grant" section (grant name, shares, grant price + start date in a 2-col grid, vesting preset select, frequency select, custom Total Vest / Cliff months when preset is `custom`), an "Add Grant" secondary button, and a conditional removable list of added grants. Replaced `rsuGrants: []` with `rsuGrants: compareRsuGrants` in `handleCalculate`.
- **Task 3** — `npm run build` (`tsc -b && vite build`) passes with no TypeScript or Vite errors. Throwaway runtime check `/tmp/verify-rsu.mjs` (not committed) imported the real `calcAnnualRSU`, fed it a 1000-share `4yr-1yr-cliff` grant dated ~12 months in the past (so its cliff vest lands in the current calendar year and survives the `current-year` timeMode filter), and asserted the result `> 0` — it returned **37500**, proving real non-zero values now flow through.

## Must-Haves Verified

- User can enter one or more RSU grants (name, shares, grant price, start date, vesting schedule) — yes, inline form.
- User can add and remove grants before calculating — `addCompareRsuGrant` / `removeCompareRsuGrant`.
- RSU (Annual) compare cell shows non-$0 when grants entered with an in-window vest — proven by runtime assertion (37500).
- RSU delta reflects the real primary-vs-compare difference — the table already computes the delta from `calcAnnualRSU(comparePackage)`, now fed real grants.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Restored missing project dependencies**
- **Found during:** Task 3 (build step).
- **Issue:** The worktree had no `node_modules` and `tsc` was not on PATH, so `npm run build` could not run. Git worktrees share tracked files but not untracked install output.
- **Fix:** Ran `npm ci` from the committed `package-lock.json` to restore the project's already-declared dependencies. No new package was added or substituted (the package-install exclusion in Rule 3 covers *new* packages; this is a clean restore of the documented environment).
- **Files modified:** None tracked (`node_modules/` is gitignored).
- **Commit:** N/A (environment restore, not a code change).

### Design choice (within plan latitude)
- Used a `<select>` dropdown for the vesting preset rather than three buttons, to fit the narrow 1/3-width compare column. The plan explicitly permitted a select as an acceptable alternative.

## Authentication Gates

None.

## Known Stubs

None. The compare RSU path is fully wired end-to-end.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary surface introduced. Numeric inputs are coerced with `Number(...)` and downstream calculators already guard with `|| 0` / `Math.floor` (per the plan's accepted T-06-01 disposition).

## Files

- Modified: `src/components/compensation/CompareView.tsx`

## Commits

- `9ca922d` feat(06-04): add compare RSU grant state and add/remove handlers
- `ac8ba7b` feat(06-04): render compare RSU input section and wire grants into setComparePackage

## Self-Check: PASSED

- FOUND: src/components/compensation/CompareView.tsx
- FOUND: .planning/phases/06-total-compensation-calculator/06-04-SUMMARY.md
- FOUND commits: 9ca922d, ac8ba7b
