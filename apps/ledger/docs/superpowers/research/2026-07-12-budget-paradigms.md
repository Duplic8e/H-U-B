# Budget Paradigms: Make Them Functional, or Remove Them?

Research writeup for Mishat. Date: 2026-07-12. Author: Claude (Fable 5).
Status: decision pending (see Decision Log at the end).

This document is analysis only. No code was changed producing it.

---

## 1. Current state

The app exposes a "Paradigm" selector in Budget Setup. A user can pick a value,
the value persists across reloads, and it changes nothing about how the budget
behaves. It is a stored label with zero behavioral effect.

### Where it lives in code

- **Type definition** - `src/types/budget.ts:1`
  ```ts
  export type BudgetingParadigm = 'Target-Based' | 'Zero-Based' | 'Ledger Custom';
  ```

- **Store field, default, and setter** - `src/store/useBudgetStore.ts`
  - `paradigm: BudgetingParadigm;` declared at line 34
  - default `paradigm: 'Ledger Custom'` at line 66
  - `setParadigm: (paradigm) => set({ paradigm })` at line 73 (pure assignment, no side effects)
  - persisted under key `ledger-budget` via the `persist` middleware at line 180, so the choice survives reloads

- **The empty enforcement hook** - `src/store/useBudgetStore.ts:247-252`
  ```ts
  // Enforce Paradigm Math
  if (state.paradigm === 'Zero-Based') {
    // In Zero-Based, unallocated MUST strictly be Income minus Targets.
    // If they overspend a category, it doesn't automatically reduce unallocated.
    // They must manually reallocate.
  }
  ```
  The `if` body is empty. `unallocated` and `remaining` are already computed the
  same way for every paradigm at lines 244-245:
  ```ts
  let unallocated = totalIncome - totalTarget;
  let remaining = totalTarget - spent;
  ```
  So all three paradigms produce identical numbers today.

- **The selector UI** - `src/components/budget/CategoryManagerWidget.tsx:92-103`
  ```tsx
  <label ...>Paradigm:</label>
  <ThemedSelect
    value={paradigm}
    onChange={(v) => setParadigm(v as any)}
    options={[
      { value: 'Ledger Custom', label: 'Ledger Custom' },
      { value: 'Zero-Based', label: 'Zero-Based' },
      { value: 'Envelope', label: 'Envelope System' },
      { value: '50/30/20', label: '50/30/20 Rule' },
    ]}
  />
  ```

- **Where the numbers surface** - `getMonthlyBudgetStats` at
  `src/store/useBudgetStore.ts:202` returns `{ spent, remaining, unallocated }`,
  consumed by `src/components/dashboard/widgets/BudgetHealthWidget.tsx:21,30`
  (renders `{unallocated} unallocated`). This is the single consumer that a
  paradigm rule would influence today.

### Two defects worth flagging while we are here

1. **The UI options do not match the type.** The type union is
   `Target-Based | Zero-Based | Ledger Custom`. The dropdown offers
   `Ledger Custom`, `Zero-Based`, `Envelope`, `50/30/20`. So:
   - `Target-Based` (a real type member the empty `if` and prior research both
     reference) is **not selectable**.
   - `Envelope` and `50/30/20` are selectable but are **not** valid
     `BudgetingParadigm` values. They only pass compilation because `onChange`
     casts through `as any` (`CategoryManagerWidget.tsx:95`). Selecting either
     writes an out-of-type string into persisted state.
   Any decision below that keeps the selector must reconcile these lists first.

2. **Prior research assumed richer mechanics than shipped.** The Phase 7 research
   and context docs (`.planning/phases/07-budgeting-paradigms/07-RESEARCH.md`,
   `07-CONTEXT.md`) describe Zero-Based as strict YNAB-style "every dollar
   assigned, overspend covered via Reallocations," a monthly reset with a savings
   sweep, and carry-over selectors. The store has the data model for this
   (`reallocations`, `getMonthlyBudgetStats`) but none of the paradigm-specific
   enforcement or carry-over logic was implemented. The selector is the visible
   remnant of an engine that was scoped but not built. (`07-PLAN.md` only tasked
   the store and types, not the enforcement, so this is a scope gap, not a
   regression.)

---

## 2. What each paradigm could mean (concrete rule sets)

If we make the selector functional, here is a concrete, implementable rule set
per paradigm. All rules operate on the existing month totals already computed in
`getMonthlyBudgetStats`: `totalIncome`, `totalTarget`, `spent`, plus per-category
effective targets and per-category spend.

### Zero-Based (strict)

- **Invariant:** every dollar of income is assigned. `unallocated` must equal 0.
- **Warn when income does not match assignments:** if
  `totalIncome !== totalTarget`, surface a banner: "You have {unallocated}
  unassigned - assign it to a category" (positive) or "You have assigned
  {abs(unallocated)} more than you earned" (negative). This is a UI warning, not
  a hard block.
- **Overspend requires explicit reallocation:** when a category's spend exceeds
  its effective target, the overage does **not** silently reduce `unallocated`.
  The user must create a `Reallocation` (the data model already exists) moving
  budget from another category to cover it. Until they do, the category shows red
  / "needs coverage." This is exactly what the comment at
  `useBudgetStore.ts:249-251` already sketches.
- **Net effect on stats:** `unallocated` stays `income - targets` (never absorbs
  overspend); overspent categories are flagged rather than netted.

### Target-Based (soft ceilings)

- **Targets are ceilings, not contracts.** Under-spending is fine and expected;
  no warning for a surplus.
- **Unallocated is a "buffer," not an error.** `income - targets` is displayed as
  available buffer, framed positively rather than as something to zero out.
- **Overspend rolls against the buffer automatically.** When a category exceeds
  its target, the overage is netted out of the buffer without requiring a manual
  reallocation. Only when the buffer itself goes negative do we warn.
- **Net effect on stats:** `remaining` / `unallocated` behave like a single
  pooled cushion; the friction of Zero-Based reallocations is removed.

### Ledger Custom (freeform, current behavior)

- **No enforcement.** This is exactly what ships today: targets are tracked,
  `unallocated = income - targets`, `remaining = targets - spent`, and nothing is
  warned, blocked, or auto-netted. Reallocations are available if the user wants
  them but never required.
- Documenting this paradigm is essentially writing down "the current code is the
  spec." It needs no new logic, only a label and (ideally) a tooltip saying so.

The three differ only in how overspend and surplus are treated: Zero-Based flags
and demands manual coverage, Target-Based auto-absorbs into a buffer, Ledger
Custom ignores both.

---

## 3. Options going forward

Effort estimates are grounded in the actual code above. The paradigm currently
influences exactly one computed value (`unallocated`) surfaced in exactly one
widget (`BudgetHealthWidget`), so the blast radius of any option is small.

### Option A - Implement the rules

Make the selector do what it says.

- **Work required:**
  - Fix the type/UI mismatch: align the dropdown to the real union (drop
    `Envelope` and `50/30/20` or add them to the type), remove the `as any` cast.
  - Fill the empty `if` at `useBudgetStore.ts:247-252` and branch the
    `unallocated` / `remaining` math per paradigm; add per-category overspend flags
    to the returned stats shape.
  - Add UI: warning banners for Zero-Based, "buffer" framing for Target-Based,
    a reallocation entry point (the `addReallocation` action and `Reallocation`
    type already exist, so the store side is mostly there; the UI to create one
    does not appear to exist yet and is the bulk of the cost).
  - Tests for the branch math.
- **Estimate:** roughly 1 to 2 days. The store math is a few hours; the
  reallocation-creation UI and the Zero-Based warning states are the real cost,
  since no reallocation UI exists today.
- **Risk:** introduces real behavior differences users can get wrong (e.g.,
  Zero-Based blocking them). Needs product thought, not just code.

### Option B - Remove the selector

Delete the feature and stop implying strictness we do not enforce.

- **Work required:**
  - Remove the `<ThemedSelect>` block at `CategoryManagerWidget.tsx:90-105`.
  - Remove `paradigm` / `setParadigm` from the store (lines 34, 41, 66, 73) or
    keep the field for persisted-state compatibility but stop reading it.
  - Delete the empty `if` at lines 247-252.
  - Add a `persist` migration (store is at `version: 2`, `useBudgetStore.ts:181`)
    to drop the stale `paradigm` key from existing users' localStorage, or simply
    leave the orphaned key (harmless).
- **Estimate:** roughly 1 to 2 hours.
- **Risk:** lowest. Removes a broken affordance. Loses a "someday" hook, but that
  hook is trivially re-addable if wanted later.

### Option C - Keep as label-only with a tooltip

Keep the selector but be honest that it is descriptive, not enforcing.

- **Work required:**
  - Fix the type/UI mismatch (same as Option A's first bullet - non-negotiable
    if we keep it, because `Envelope`/`50/30/20` are currently out-of-type).
  - Add a tooltip / helper text next to the label explaining that the paradigm
    describes your intended philosophy and that Ledger tracks the same numbers
    regardless. Remove the misleading "Enforce Paradigm Math" comment.
  - No math changes.
- **Estimate:** roughly 2 to 3 hours (mostly the copy and the tooltip component).
- **Risk:** low, but it preserves a control that does nothing, which invites the
  same "why doesn't this do anything?" question again later.

### Recommendation

**Option B (remove), unless functional budgeting is on the near-term roadmap - in
which case Option A.**

Reasoning: the selector today is a correctness liability, not a feature. It ships
two out-of-type values through an `as any`, hides the one real type member
(`Target-Based`), and carries a comment ("Enforce Paradigm Math") that describes
enforcement that does not exist. Option C keeps a dead control alive and still
requires the type/UI cleanup, so it pays most of the cost of doing it right
without the benefit. Option A is genuinely worth doing **if** paradigm-driven
budgeting is a product direction Mishat wants, because the data model
(`reallocations`, `getMonthlyBudgetStats`) is already shaped for it and the math
is cheap; the honest cost is the reallocation UI, not the store. If that is not a
near-term priority, removing the selector is the smallest change that leaves the
codebase truthful, and re-adding the hook later is a one-hour job.

Concretely: if this quarter includes "real budgeting enforcement," pick A. If it
does not, pick B now and revisit A when it does.

---

## 4. Decision log

> To be filled in by Mishat.

- **Decision:** _(A implement / B remove / C label-only / defer)_
- **Date:**
- **Rationale:**
- **Follow-up task:** _(links to the task that implements the chosen direction)_
