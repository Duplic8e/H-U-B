# Desktop 95 to 100: the three open items

Not a plan, a note. `UI_UX_AUDIT_2026-08-20.md` scores desktop and tablet at 95 after the
0.9.5-beta remediation. These are the three deductions, with the investigation already done so
whoever picks them up does not have to redo it.

Ordered by value for effort.

---

## 1. Numeric inputs render raw digits (audit area 5, worth 2 points)

Gross Annual Income shows `100000` and Home Price shows `600000`, while every displayed figure
beside them is formatted. This was the input half of the audit's D4 finding; only the axis half
was ever in a task's scope.

**Where.** `src/components/ui/NumberInput.tsx`, the `display()` function. It is the single
place a not-editing value is rendered, so grouping goes there and nowhere else. The editing path
already bypasses it through the local `text` buffer, so typing is unaffected by construction.

**The wrinkle that makes this not a one-liner.** 16 of the 20 `NumberInput` call sites pass
`maxDecimals` because they hold rates and percents, not money: `4.5`, `2.5`, `1.3700`. Those
must not get separators. So this needs an opt-in prop (something like `groupThousands`) applied
at the money call sites only: gross income, home price, starting balance, annual spending in
retirement, and the mortgage and forecaster amount fields. A blanket change would put a comma in
an interest rate.

**Risk.** Low. Display only, editing untouched, and `NUMERIC` already rejects commas on input so
a grouped string can never round-trip into the parser.

---

## 2. Manual price overrides are stamped USD (audit area 4, worth 1 point)

This is a wrong number, not a disagreement, which is why the whole-branch review called it the
first thing to do after merge.

**Where.** `src/services/marketData/marketDataService.ts`, in `getCurrentPrice`: an override is
wrapped in a synthetic quote with `currency: 'USD'` hardcoded, regardless of the holding.

**Why it is wrong.** `convertedPrice` (`src/utils/investments/portfolioMetrics.ts:100`) returns
the price untouched when the quote currency matches the holding's, and converts otherwise. So a
CAD holding carrying an override is converted USD to CAD and inflated by roughly the FX rate.
An override is a price the user typed for that holding, so it is in the holding's currency by
definition.

**Reachable how.** `src/components/investments/PositionCard.tsx` writes holding-keyed overrides
for wheel positions, and `quoteKey(ticker, exchange)` is shared with holdings, so a CAD holding
whose ticker also carries a wheel override hits this.

**Shape of the fix.** `getCurrentPrice` does not know the holding, so the expected currency has
to come from the caller and be stamped on the synthetic quote instead of the constant. That is a
signature change across its callers. Do not instead widen the override store to carry a
currency: that is a persisted shape change needing a migration, for no extra benefit.

**Do not** make the override quote `currency: null`. Null flows into `convertAmount`, returns
null, and falls back to cost basis, which silently ignores a price the user explicitly typed.

**Risk.** Moderate, because it is money on screen. Give it what Task 12 got: a parity test
pinning both portfolio surfaces to the same figure, and a guard.

---

## 3. Card dead space (audit area 3, worth 2 points)

Income, Receivables, Monthly Summary and Package Details reserve fixed heights and leave 100 to
300px voids at desktop width.

**Why this one is different.** The other two have a crisp right answer you can write a failing
test for first. This does not. It is a design judgement across several bento-grid widgets, there
is no pass/fail line to guard, and the rubric being scored against was written by the same
process doing the scoring. Worth doing, but it wants a human eye on the result rather than a
green check, and a 10 here is softer than the other two.

---

## Also open, from the same work

- `e2e/desktop-guards.spec.ts`'s `every chart has an accessible name` counts unwrapped chart
  wrappers, so a route that renders zero charts is indistinguishable from a pass. A positive
  per-route count assertion closes it.
- `src/components/ui/Tabs.tsx` emits `aria-controls` for panels that are not rendered, because
  panels are conditionally mounted. Either always render them with `hidden`, or drop the
  attribute.
- `src/pages/Investments.tsx`'s default tab is data-derived, so a user sitting on the
  parameterless default is moved from Portfolio to Plan vs Actual the moment they save their
  first analysis.
- One pre-existing flaky unit test in `App.test.tsx`, lazy-chunk timing under full-suite CPU
  load. Passes in isolation and on rerun. Predates this branch.
