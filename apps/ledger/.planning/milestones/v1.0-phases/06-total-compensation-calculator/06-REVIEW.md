---
phase: 06-total-compensation-calculator
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/components/compensation/CompareView.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed the gap-closure change (plan 06-04) to `CompareView.tsx`, which adds an
RSU/equity-grant sub-form to the offer-comparison view and wires the collected
grants into `setComparePackage` (previously hardcoded `rsuGrants: []`).

The new `RSUGrant` shape, `VestingSchedule` construction, and `crypto.randomUUID()`
keying all match the canonical equity path in `CompensationModal.handleSaveRSU`,
and the wiring into `setComparePackage` is type-correct against the store's
`CompensationPackage` interface. No security issues and no crashing/data-loss
defects were found.

However, the form inherits an unguarded number-coercion path that can produce a
`NaN`/`Infinity` vesting computation, the add-handler resets state inconsistently,
and there are several consistency gaps versus the primary equity path. Findings
below.

## Warnings

### WR-01: Custom vesting months are unvalidated — empty/zero `totalVestMonths` produces NaN/Infinity vest values

**File:** `src/components/compensation/CompareView.tsx:40-61` (specifically 45-46)
**Issue:** The add guard only checks `rsuGrantName`, `rsuGrantShares`, `rsuGrantPrice`:

```ts
if (!rsuGrantName || !rsuGrantShares || !rsuGrantPrice) return
...
totalVestMonths: rsuPreset === 'custom' ? Number(rsuTotalMonths) : ...,
cliffMonths:     rsuPreset === 'custom' ? Number(rsuCliffMonths) : ...,
```

When `rsuPreset === 'custom'`, the custom-months fields are never validated. If the
user clears the "Total Vest (months)" field, `Number('')` evaluates to `0`. That
zero flows into `generateVestEvents` (useCompensationStore.ts:172-195) where
`cliffMonths / totalVestMonths` → `0/0 = NaN` (or `cliff/0 = Infinity`), poisoning
`vestValue` and therefore `calcAnnualRSU` → `calcTotalComp`. The compare column and
every Delta then render `$NaN`. `cliffMonths > totalVestMonths` is likewise
accepted and yields a negative `postCliffShares`. This is the same flaw present in
`CompensationModal.handleSaveRSU` (consistent, but still a real correctness bug in
the newly added code).
**Fix:** Validate the custom inputs before constructing the schedule, e.g.:

```ts
const totalMonths = Number(rsuTotalMonths)
const cliff = Number(rsuCliffMonths)
if (rsuPreset === 'custom' && (!Number.isFinite(totalMonths) || totalMonths <= 0 || cliff < 0 || cliff > totalMonths)) return
```

### WR-02: `addCompareRsuGrant` resets only name and shares — stale price/date/preset persist into the next grant

**File:** `src/components/compensation/CompareView.tsx:59-60`
**Issue:** After adding a grant, only `setRsuGrantName('')` and `setRsuGrantShares('')`
run. `rsuGrantPrice`, `rsuStartDate`, `rsuPreset`, `rsuTotalMonths`, `rsuCliffMonths`,
and `rsuFrequency` retain their previous values. When entering a second grant the
user silently reuses the first grant's price/schedule unless they notice and change
them — an easy source of wrong comparison numbers. (Mirrors `handleSaveRSU`, but
there the modal at least has an edit flow; here there is none, so the stale state is
purely a footgun.)
**Fix:** Reset the full grant sub-form after a successful add (price/date/preset/
months/frequency back to their initial defaults), or factor a `resetGrantForm()`
helper and call it.

### WR-03: Added grants are not reflected until the user re-clicks "Calculate Comparison" — no feedback that the table is stale

**File:** `src/components/compensation/CompareView.tsx:40-65, 67-84`
**Issue:** `compareRsuGrants` lives in local state and is only pushed into the store
inside `handleCalculate`. If the user has already calculated, then adds or removes a
grant, the comparison table (driven by `comparePackage.rsuGrants` from the store)
silently shows stale RSU/Total numbers with no indication they are out of date.
Because the grant list and the results both render in the same view, this is easy to
trip over.
**Fix:** Either recompute on grant add/remove (call a shared `recalculate()` that
also re-runs `setComparePackage`), or visually flag the results as stale until
"Calculate Comparison" is pressed again (e.g. disable/dim the delta panel or show a
"recalculate" hint).

## Info

### IN-01: `compareName` state has no setter and is effectively a constant

**File:** `src/components/compensation/CompareView.tsx:17`
**Issue:** `const [compareName] = useState('Compare Offer')` — the setter is never
destructured or used, so this is a constant dressed up as state. The form also never
lets the user name the compare offer, unlike the implied intent.
**Fix:** Replace with a plain `const compareName = 'Compare Offer'`, or add an input
to edit it if naming was intended.

### IN-02: ESPP discount default diverges from the primary equity/benefits path

**File:** `src/components/compensation/CompareView.tsx:77`
**Issue:** `esppDiscountPercent: Number(compareEsppDiscountPercent) || 0` defaults an
emptied field to `0`, whereas `CompensationModal.handleSubmit` (line 129) uses
`esppDiscountPercent === '' ? 15 : Number(...)`, defaulting to 15. With a 0% discount
and no lock-in, `calcAnnualESPP` computes purchase price at full market price and
yields ~$0 benefit — a different result than the primary path for the same blank
input. Low likelihood (field defaults to '15' and is `type=number`) but an
inconsistency between the two compensation entry surfaces.
**Fix:** Mirror the modal: `esppDiscountPercent: compareEsppDiscountPercent === '' ? 15 : Number(compareEsppDiscountPercent)`.

### IN-03: Numeric coercion via `Number(...) || fallback` silently maps NaN to a fallback across all fields

**File:** `src/components/compensation/CompareView.tsx:71-81`
**Issue:** All scalar fields use the `Number(x) || fallback` idiom. For the cash-bonus
month, `Number(compareCashBonusMonth) || 12` is harmless (driven by a `<select>`),
but the pattern means any genuinely invalid numeric entry is silently coerced rather
than surfaced to the user. Consistent with the modal; flagged only as a maintainability
/UX note, not a correctness defect for the `<input type=number>`-backed fields.
**Fix:** Consider a shared `toNumber(value, fallback)` helper used by both forms so
validation behavior stays consistent if it is later tightened.

### IN-04: Grant sub-form duplicates `CompensationModal` schedule-construction logic

**File:** `src/components/compensation/CompareView.tsx:43-48`
**Issue:** The `VestingSchedule` construction (preset → totalVestMonths/cliffMonths
mapping) is copy-pasted from `CompensationModal.handleSaveRSU:53-58`. The magic
numbers (`48`, `36`, `12`, `0`) for the presets now live in two places; a future
change to a preset definition must be made in both or the two paths will silently
disagree.
**Fix:** Extract a shared `buildVestingSchedule(preset, frequency, customMonths,
customCliff): VestingSchedule` (and the preset constants) into the store module or a
shared helper, and call it from both components.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
