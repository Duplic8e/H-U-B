# Project Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `npx eslint src` from 33 problems to 0, add line-ending/encoding guards so the July 2026 CRLF corruption incident cannot recur, and clear repo housekeeping debt.

**Architecture:** Nine independent tasks, ordered so guards land first, then mechanical lint fixes, then typed refactors, then housekeeping. Every task is behavior-preserving; existing Vitest tests plus `tsc` are the regression net. Each task ends with an exact expected `eslint src` problem count so drift is caught immediately.

**Tech Stack:** Vite 7 + React 19 + TypeScript, ESLint 9 flat config (`eslint.config.js`), Vitest, PapaParse, Recharts, Zustand.

> **Supersedes** the 2026-07 version of this file. That version's P0 ("working tree corrupted, tsc fails, restore src/") was audited on 2026-07-07 and is **obsolete**: the tree is clean, `tsc --noEmit` passes, and HEAD (`97c3f23`) is 10+ commits past the corruption. **Do not run `git restore src/`.**

## Global Constraints

- Verification trio after every task: `npx tsc --noEmit` (exit 0, no output), `npx vitest run` (all pass), `npx eslint src` (count matches the task's stated target).
- No new runtime dependencies. No devDependencies except none — nothing here needs one.
- All files written as UTF-8, LF line endings (Task 1 enforces this repo-wide).
- Behavior-preserving only: no visual or logic changes beyond what each task states.
- Baseline (verified 2026-07-07): `eslint .` = 289 problems; `eslint src` = 33 problems (31 errors, 2 warnings); `tsc --noEmit` clean.

---

### Task 1: Line-ending and encoding guards

Root-cause prevention for the CRLF corruption incident. Also fixes a casualty of that same incident: [.gitignore](../.gitignore) line 25 reads `c s v - e x a m p l e s /` (space-interleaved characters — UTF-16 damage), so the intended `csv-examples/` ignore never worked and the directory got committed.

**Files:**
- Create: `.gitattributes`
- Create: `.editorconfig`
- Modify: `.gitignore:25-26`

**Interfaces:**
- Produces: repo-wide `eol=lf` normalization. All later tasks write LF files.

- [ ] **Step 1: Record the baseline**

Run: `npx tsc --noEmit; npx vitest run; npx eslint src`
Expected: tsc silent, tests pass, eslint reports exactly `33 problems (31 errors, 2 warnings)`. If not, stop — the repo has drifted from this plan; re-audit before proceeding.

- [ ] **Step 2: Create `.gitattributes`**

```gitattributes
* text=auto eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.css text eol=lf
*.html text eol=lf
*.json text eol=lf
*.md text eol=lf
*.png binary
*.ico binary
```

- [ ] **Step 3: Create `.editorconfig`**

```ini
root = true

[*]
end_of_line = lf
charset = utf-8
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2
```

- [ ] **Step 4: Repair the mangled `.gitignore` line**

Replace lines 25–26 (the space-interleaved `c s v - e x a m p l e s /  ` line and the whitespace-only line after it) with:

```gitignore
csv-examples/
```

Note: `csv-examples/` is already **tracked**, so this ignore alone won't hide it. Whether to untrack it is a user decision recorded in Task 9 — do not `git rm` here.

- [ ] **Step 5: Renormalize line endings**

Run: `git add --renormalize .`
Then: `git diff --cached --stat`
Expected: only line-ending changes (diff with `git diff --cached -w` should show no content changes). If any file shows real content changes, unstage it and investigate before committing.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit; npx vitest run`
Expected: both clean/green.

- [ ] **Step 7: Commit**

```bash
git add .gitattributes .editorconfig .gitignore
git commit -m "chore: enforce LF line endings; repair mangled csv-examples gitignore entry"
```

---

### Task 2: Scope ESLint to app code

[eslint.config.js](../eslint.config.js) only ignores `dist`, so `eslint .` lints the `.claude/` GSD framework, `.planning/`, and sketch HTML — 289 problems of noise burying the 33 real ones.

**Files:**
- Modify: `eslint.config.js:9`

**Interfaces:**
- Produces: `npx eslint .` and `npx eslint src` report identical results; `npm run lint` (which runs `eslint .`) becomes usable.

- [ ] **Step 1: Widen `globalIgnores`**

In `eslint.config.js` change line 9 from:

```js
  globalIgnores(['dist']),
```

to:

```js
  globalIgnores(['dist', '.claude', '.planning', '.superpowers', 'theme-sketches', 'csv-examples']),
```

(`node_modules` is ignored by default in flat config — do not add it.)

- [ ] **Step 2: Verify scope**

Run: `npx eslint .`
Expected: exactly `33 problems (31 errors, 2 warnings)` — identical to `npx eslint src`.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore: scope eslint to app code, ignoring framework and sketch dirs"
```

---

### Task 3: Mechanical lint fixes (auto-fix + dead writes + BOM regex)

Clears 7 findings: `prefer-const` ×2, `no-useless-assignment` ×3, the unused `eslint-disable` directive, and `no-irregular-whitespace`.

**Files:**
- Modify: `src/store/useBudgetStore.ts:186,219,221-222`
- Modify: `src/utils/csvParser.ts:62-63`
- Modify: `src/components/ErrorBoundary.tsx:27`
- Modify: `src/utils/portfolioCsv.ts:89`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: no signature changes anywhere.

- [ ] **Step 1: Run the auto-fixer**

Run: `npx eslint src --fix`
Expected: fixes the two `prefer-const` in `useBudgetStore.ts` (lines 221–222 `let unallocated` / `let remaining` become `const`) and removes the unused `// eslint-disable-next-line no-console` at `ErrorBoundary.tsx:27`. Confirm with `git diff --stat` — only those two files change.

- [ ] **Step 2: Fix the `totalTarget` dead write in `useBudgetStore.ts`**

Delete line 186 (`  let totalTarget = 0;`) and change line 219 from:

```ts
  totalTarget = Object.values(categoryEffectiveTargets).reduce((sum, amt) => sum + amt, 0);
```

to:

```ts
  const totalTarget = Object.values(categoryEffectiveTargets).reduce((sum, amt) => sum + amt, 0);
```

- [ ] **Step 3: Fix the `amount`/`type` dead writes in `csvParser.ts`**

Change lines 62–63 from:

```ts
      let amount = 0;
      let type: 'income' | 'expense' = 'expense';
```

to:

```ts
      let amount: number;
      let type: 'income' | 'expense';
```

(Both variables are assigned in every branch that doesn't `return null`, so definite-assignment analysis passes.)

- [ ] **Step 4: Fix the BOM regex in `portfolioCsv.ts`**

Line 89 contains a **literal BOM character** inside a regex — that's the "irregular whitespace". It is intentional (it strips the BOM from the first CSV header), so replace the literal with its escape, not delete it:

```ts
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit; npx vitest run; npx eslint src`
Expected: tsc silent, tests green, eslint now `26 problems (25 errors, 1 warning)`.

- [ ] **Step 6: Commit**

```bash
git add src/store/useBudgetStore.ts src/utils/csvParser.ts src/components/ErrorBoundary.tsx src/utils/portfolioCsv.ts
git commit -m "fix: remove dead writes, stale lint suppression, and literal BOM in regex"
```

---

### Task 4: Type the CSV parser (`csvParser.ts` — 5 × `no-explicit-any`)

Rows are either `Record<string, string>` (header mode) or `string[]` (headerless mode). Model that as a union and narrow with `Array.isArray`.

**Files:**
- Modify: `src/utils/csvParser.ts`
- Modify: `src/components/budget/CSVUploader.tsx:101` (consumer ripple)

**Interfaces:**
- Produces: `export type RawRow = Record<string, string> | string[]`; `UnrecognizedCSVResult.rows: RawRow[]`; `BankParserConfig.detect(headers: string[], firstRow: RawRow | undefined)`; `BankParserConfig.parse(row: RawRow)`. Task 6 touches the same `CSVUploader.tsx` file but different lines.

- [ ] **Step 1: Replace the `any` types with a `RawRow` union**

At the top of `csvParser.ts`, change the interfaces (lines 5–15) to:

```ts
export type RawRow = Record<string, string> | string[];

export interface UnrecognizedCSVResult {
  unrecognized: true;
  headers: string[];
  rows: RawRow[];
}

export interface BankParserConfig {
  name: string;
  detect: (headers: string[], firstRow: RawRow | undefined) => boolean;
  parse: (row: RawRow) => Omit<TriageTransaction, 'id' | 'categoryId'> | null;
}
```

- [ ] **Step 2: Narrow inside each record-based parser**

The three header-based parsers ('Preferred Package', 'Download Transactions (Visa)', 'Standard Ledger CSV') index rows by name, so add a guard as the first line of each `parse`:

```ts
    parse: (row) => {
      if (Array.isArray(row)) return null;
      // ...existing body unchanged...
```

The 'Account Activity (Headerless)' parser already starts with `if (!Array.isArray(row) || row.length < 5) return null;` — change its signature from `parse: (row: string[]) =>` to `parse: (row) =>` (the guard does the narrowing).

- [ ] **Step 3: Type the PapaParse call in `parseCSV`**

Change line 131 from `Papa.parse<any>(file, {` to:

```ts
    Papa.parse<RawRow>(file, {
```

and change the unrecognized-branch header synthesis (line 143) from:

```ts
            headers: isHeaderless ? firstRow.map((_: any, i: number) => `Column ${i + 1}`) : headers,
```

to:

```ts
            headers: isHeaderless && Array.isArray(firstRow) ? firstRow.map((_, i) => `Column ${i + 1}`) : headers,
```

- [ ] **Step 4: Fix the consumer ripple in `CSVUploader.tsx`**

`handleMappingSubmit` (line 101) assigns `originalRowData: row` where `row` is now `RawRow` but `TriageTransaction.originalRowData` is `Record<string, string>`. Change it to:

```ts
        originalRowData: Array.isArray(row) ? Object.fromEntries(row.map((v, i) => [String(i), v])) : row
```

(The `getVal` helper at line 71 already handles both shapes — no change there.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit; npx vitest run; npx eslint src`
Expected: tsc silent (if it flags other `UnrecognizedCSVResult.rows` consumers, narrow them the same `Array.isArray` way), tests green, eslint `21 problems (20 errors, 1 warning)`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/csvParser.ts src/components/budget/CSVUploader.tsx
git commit -m "refactor: replace any with RawRow union in CSV parser"
```

---

### Task 5: Hoist and type the chart tooltips (2 × `static-components`, 11 × `no-explicit-any`)

`CustomTooltip` (CompHeroWidget) and `CustomEquityTooltip` (EquityVestingWidget) are defined **inside** their components — recreated every render, losing state and defeating reconciliation. Neither closes over any component-scope variable, so both hoist cleanly to module scope. Typing their props kills most of the file's `any`s at the same time.

**Files:**
- Modify: `src/components/compensation/CompHeroWidget.tsx:29-57,115,193`
- Modify: `src/components/compensation/EquityVestingWidget.tsx:22-61,109`

**Interfaces:**
- Consumes: `VestEvent` from `../../store/useCompensationStore` (already imported in EquityVestingWidget via generateVestEvents usage; add to imports if not).
- Produces: module-scope `ChartTooltipProps` in each file (kept local per file — only two uses, not worth a shared module yet; DRY it if a third chart appears).

- [ ] **Step 1: Hoist `CustomTooltip` in `CompHeroWidget.tsx`**

Delete the `const CustomTooltip = ({ active, payload, label }: any) => {...}` block (lines 30–57, currently the first thing inside `CompHeroWidget`). Above the `CompHeroWidget` function (after `COMP_COLORS`), add:

```tsx
interface TooltipEntry {
  name?: string
  value?: number
  color?: string
  dataKey?: string | number
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)
  return (
    <div className="themed-card rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <p className="font-semibold text-[var(--color-text-primary)] mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex justify-between items-center gap-4 text-[13px] mb-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-[var(--color-text-secondary)]">{entry.name}</span>
          </div>
          <span className="text-[var(--color-text-primary)] font-medium">
            {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(entry.value ?? 0)}
          </span>
        </div>
      ))}
      <div className="flex justify-between items-center gap-4 text-[13px] mt-2 pt-2 border-t border-[var(--color-border)]">
        <span className="text-[var(--color-text-primary)] font-semibold">Total</span>
        <span className="text-[var(--color-text-primary)] font-bold">
          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(total)}
        </span>
      </div>
    </div>
  )
}
```

The `<Tooltip content={<CustomTooltip />} ...>` usage at line ~216 needs no change.

- [ ] **Step 2: Fix the two remaining `any`s in `CompHeroWidget.tsx`**

Line 115 — `generateVestEvents` returns `VestEvent[]`, so drop the annotation and let inference work:

```ts
      const eventsThisMonth = events.filter((e) => {
```

Line 193 — the pie `Tooltip formatter`:

```tsx
                  formatter={(value: number | string, name: string) => [
                    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Number(value)),
                    name
                  ]}
```

- [ ] **Step 3: Hoist `CustomEquityTooltip` in `EquityVestingWidget.tsx`**

Delete the inner `const CustomEquityTooltip = ...` block (lines 22–61). Above `EquityVestingWidget`, add the same `TooltipEntry`/`ChartTooltipProps` interfaces as in Step 1, then:

```tsx
function CustomEquityTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const barPayloads = payload.filter((p) => p.dataKey !== 'cumulativeVested' && p.dataKey !== 'vestValue')
  if (barPayloads.length === 0) return null
  const totalVest = barPayloads.reduce((sum, p) => sum + (p.value ?? 0), 0)
  return (
    <div className="themed-card rounded-lg p-3 min-w-[200px]" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <p className="font-semibold text-[var(--color-text-primary)] mb-2">{label}</p>
      <div className="flex flex-col gap-1 mb-2">
        {barPayloads.map((p, i) => {
          if (p.value === 0) return null
          return (
            <div key={i} className="flex justify-between items-center gap-4 text-[13px]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
                <span className="text-[var(--color-text-secondary)]">{p.name}</span>
              </div>
              <span className="text-[var(--color-text-primary)] font-medium">
                {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(p.value ?? 0)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between items-center gap-4 text-[13px] pt-2 border-t border-[var(--color-border)]">
        <span className="text-[var(--color-text-primary)] font-semibold">Total Vesting</span>
        <span className="text-[var(--color-text-primary)] font-bold">
          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(totalVest)}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type `dataRow` in `EquityVestingWidget.tsx`**

Line 109, change:

```ts
    const dataRow: any = { monthLabel: dm.label, vestValue: 0 }
```

to:

```ts
    const dataRow: Record<string, number | string> = { monthLabel: dm.label, vestValue: 0 }
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit; npx vitest run; npx eslint src`
Expected: tsc silent, tests green, eslint `8 problems (7 errors, 1 warning)`. Then eyeball both widgets in the app (`npm run dev`, Compensation page): hover the bar charts — tooltips must render identically.

- [ ] **Step 6: Commit**

```bash
git add src/components/compensation/CompHeroWidget.tsx src/components/compensation/EquityVestingWidget.tsx
git commit -m "refactor: hoist chart tooltips to module scope with typed props"
```

---

### Task 6: Remaining `no-explicit-any` (3 sites) + stale comment

**Files:**
- Modify: `src/components/budget/CSVUploader.tsx:27,53`
- Modify: `src/types/budget.ts:1`
- Modify: `src/components/budget/CategoryManagerWidget.tsx:92`
- Modify: `src/components/compensation/CompensationModal.tsx:111`

**Interfaces:**
- Consumes: `RSUGrant` from `src/store/useCompensationStore.ts` (existing export).
- Produces: `BudgetingParadigm` union gains `'Envelope' | '50/30/20'`.

- [ ] **Step 1: `CSVUploader.tsx` — typed catch + delete stale comment**

Line 53, change:

```tsx
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV');
```

to:

```tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
```

And delete the stale line-27 comment `// NOTE: guessCategory will be updated to take categoryRules shortly.` — `guessCategory` already takes `categoryRules` on the next line.

- [ ] **Step 2: Extend `BudgetingParadigm` and drop the cast**

The `as any` at `CategoryManagerWidget.tsx:92` exists because the UI offers `'Envelope'` and `'50/30/20'` but the type doesn't include them — a latent type/UI mismatch, not just a lint nit. In `src/types/budget.ts` line 1:

```ts
export type BudgetingParadigm = 'Target-Based' | 'Zero-Based' | 'Ledger Custom' | 'Envelope' | '50/30/20';
```

In `CategoryManagerWidget.tsx`, add to the imports:

```ts
import type { BudgetingParadigm } from '../../types/budget';
```

and change line 92:

```tsx
              onChange={(v) => setParadigm(v as BudgetingParadigm)}
```

- [ ] **Step 3: Type `handleEditRSU` in `CompensationModal.tsx`**

Add `RSUGrant` to the existing `useCompensationStore` import, then line 111:

```tsx
  const handleEditRSU = (grant: RSUGrant) => {
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit; npx vitest run; npx eslint src`
Expected: tsc silent, tests green, eslint `5 problems (4 errors, 1 warning)`.

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/CSVUploader.tsx src/components/budget/CategoryManagerWidget.tsx src/components/compensation/CompensationModal.tsx src/types/budget.ts
git commit -m "refactor: eliminate remaining explicit any; extend BudgetingParadigm union"
```

---

### Task 7: Replace setState-in-effect with render-time reset (2 modals)

`TransactionModal` and `AddAccountModal` reset form state via `useEffect` + synchronous `setState` — the cascading-render antipattern (`react-hooks/set-state-in-effect`). Replace with React's documented ["adjust state during render"](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes) pattern: compare against previous props in the render body, guarded so it fires once per change. This also removes the `exhaustive-deps` warning (the effect disappears).

**Behavior note:** the old `TransactionModal` effect also re-ran when `categories` changed, wiping in-progress form input if the category list mutated while the modal was open. The new code resets only on open/close or when a different transaction is passed in — a deliberate small improvement, called out here so the reviewer sees it.

**Fallback:** if `eslint src` after this task flags the guarded render-time `setState` under a different rule, abandon the pattern in that file and instead force a remount from the parent with `key={initialTransaction?.id ?? 'new'}` (resp. `key={editingAccount?.id ?? 'new'}`), moving the initial values into the `useState` initializers.

**Files:**
- Modify: `src/components/budget/TransactionModal.tsx:33-47`
- Modify: `src/components/dashboard/AddAccountModal.tsx:28-40`

**Interfaces:**
- Consumes: `Transaction` type (already imported in TransactionModal), `Account` type (already imported in AddAccountModal).
- Produces: no prop or export changes.

- [ ] **Step 1: `TransactionModal.tsx` — replace the reset effect**

Delete the `React.useEffect(() => { ... }, [initialTransaction, isOpen, categories]);` block (lines 33–47) and the stray comment at line 24 (`// Actually, let's just use all categories from the store`). In its place, directly after the five `useState` declarations, add:

```tsx
  const [prevReset, setPrevReset] = useState<{ isOpen: boolean; initialTransaction: Transaction | null | undefined }>({ isOpen, initialTransaction });
  if (prevReset.isOpen !== isOpen || prevReset.initialTransaction !== initialTransaction) {
    setPrevReset({ isOpen, initialTransaction });
    if (initialTransaction) {
      setType(initialTransaction.type);
      setAmount(initialTransaction.amount.toString());
      setCategory(initialTransaction.categoryId || '');
      setDate(initialTransaction.date);
      setDescription(initialTransaction.description || '');
    } else {
      setType('expense');
      setAmount('');
      setCategory(categoryList.length > 0 ? categoryList[0].id : '');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    }
  }
```

- [ ] **Step 2: `AddAccountModal.tsx` — same pattern**

Delete the `useEffect(() => { if (isOpen) { ... } }, [isOpen, defaultType, editingAccount]);` block (lines 28–40). After the three `useState` declarations, add:

```tsx
  const [prevReset, setPrevReset] = useState<{ isOpen: boolean; editingAccount: Account | null | undefined }>({ isOpen, editingAccount });
  if (prevReset.isOpen !== isOpen || prevReset.editingAccount !== editingAccount) {
    setPrevReset({ isOpen, editingAccount });
    if (isOpen) {
      if (editingAccount) {
        setName(editingAccount.name);
        setValue(editingAccount.value.toString());
        setType(editingAccount.type);
      } else {
        setType(defaultType);
        setName('');
        setValue('');
      }
    }
  }
```

- [ ] **Step 3: Verify (lint + manual)**

Run: `npx tsc --noEmit; npx vitest run; npx eslint src`
Expected: tsc silent, tests green, eslint `2 problems (2 errors, 0 warnings)` — only the two `react-refresh` errors remain.

Manual check (`npm run dev`): open the transaction modal fresh (form empty, today's date), open it for an existing transaction (fields prefilled), edit an account then add a new one (no stale values leak between opens).

- [ ] **Step 4: Commit**

```bash
git add src/components/budget/TransactionModal.tsx src/components/dashboard/AddAccountModal.tsx
git commit -m "refactor: reset modal form state during render instead of via effect"
```

---

### Task 8: Extract test-only helpers to satisfy `react-refresh/only-export-components`

`trendDomain` and `menuPlacement` are pure functions exported from component files so their tests can import them — which breaks Fast Refresh for those files. Move each to its own module.

**Files:**
- Create: `src/components/dashboard/widgets/trendDomain.ts`
- Create: `src/components/ui/menuPlacement.ts`
- Modify: `src/components/dashboard/widgets/NetWorthTrendWidget.tsx:7-14,27`
- Modify: `src/components/dashboard/widgets/NetWorthTrendWidget.test.tsx:2`
- Modify: `src/components/ui/ThemedSelect.tsx:17-32,45`
- Modify: `src/components/ui/ThemedSelect.test.tsx:3`

**Interfaces:**
- Produces: `trendDomain(values: number[]): [number, number]` from `./trendDomain`; `menuPlacement(rect: { top: number; bottom: number }, viewportHeight: number): { openUp: boolean; maxHeight: number }` from `./menuPlacement`. Signatures unchanged — only the module moves.

- [ ] **Step 1: Create `src/components/dashboard/widgets/trendDomain.ts`**

```ts
/** Brokerage-style axis: track the data range with headroom, never force zero. */
export function trendDomain(values: number[]): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const pad = range > 0 ? range * 0.08 : Math.max(Math.abs(max) * 0.05, 1)
  return [min - pad, max + pad]
}
```

- [ ] **Step 2: Update `NetWorthTrendWidget.tsx`**

Delete the doc comment and `export function trendDomain` block (lines 7–14). Add to the imports:

```ts
import { trendDomain } from './trendDomain'
```

The call site (`const domain = trendDomain(history.map((h) => h.value))`) is unchanged.

- [ ] **Step 3: Update `NetWorthTrendWidget.test.tsx`**

Change line 2 to:

```ts
import { trendDomain } from './trendDomain'
```

- [ ] **Step 4: Create `src/components/ui/menuPlacement.ts`**

Move the three constants and the function verbatim:

```ts
const MENU_MAX = 256 // px, matches previous max-h-64
const MENU_MARGIN = 16
const MIN_BELOW = 160

/** Decide dropdown direction and scroll height from the trigger's rect. */
export function menuPlacement(
  rect: { top: number; bottom: number },
  viewportHeight: number,
): { openUp: boolean; maxHeight: number } {
  const below = viewportHeight - rect.bottom - MENU_MARGIN
  const above = rect.top - MENU_MARGIN
  if (below < MIN_BELOW && above > below) {
    return { openUp: true, maxHeight: Math.min(MENU_MAX, above) }
  }
  return { openUp: false, maxHeight: Math.min(MENU_MAX, Math.max(below, MIN_BELOW)) }
}
```

- [ ] **Step 5: Update `ThemedSelect.tsx`**

Delete lines 17–32 (the three constants and `export function menuPlacement`). Add to the imports:

```ts
import { menuPlacement } from './menuPlacement'
```

- [ ] **Step 6: Update `ThemedSelect.test.tsx`**

Change line 3 from `import { ThemedSelect, menuPlacement } from './ThemedSelect'` to:

```ts
import { ThemedSelect } from './ThemedSelect'
import { menuPlacement } from './menuPlacement'
```

- [ ] **Step 7: Verify — the zero milestone**

Run: `npx tsc --noEmit; npx vitest run; npx eslint src`
Expected: tsc silent, all tests green (the moved-function tests prove the extraction), and **`npx eslint src` exits clean with no output — 0 problems.** Also run `npx eslint .` — same result.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/widgets/trendDomain.ts src/components/dashboard/widgets/NetWorthTrendWidget.tsx src/components/dashboard/widgets/NetWorthTrendWidget.test.tsx src/components/ui/menuPlacement.ts src/components/ui/ThemedSelect.tsx src/components/ui/ThemedSelect.test.tsx
git commit -m "refactor: extract trendDomain and menuPlacement so component files only export components"
```

---

### Task 9: Housekeeping + user decisions

**Files:**
- Modify: `package.json:2`
- Modify: `.gitignore` (append)

**Interfaces:**
- Produces: nothing consumed by other tasks. Do this task last.

- [ ] **Step 1: Rename the package**

In `package.json` change `"name": "vite-temp"` to:

```json
  "name": "ledger",
```

- [ ] **Step 2: Ignore agent scratch dirs**

`.gitignore` currently ignores only `.superpowers/sdd/`, but `.superpowers/brainstorm/` also exists and shows as untracked noise. Replace the `.superpowers/sdd/` line with:

```gitignore
.superpowers/
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit; npx vitest run; npx eslint src; git status --porcelain`
Expected: all clean; `.superpowers/` no longer listed as untracked.

```bash
git add package.json .gitignore
git commit -m "chore: rename package to ledger; ignore .superpowers scratch dir"
```

- [ ] **Step 4: Present the open decisions to the user (do not act without an answer)**

These involve deleting tracked content or privacy judgment calls — user's call, not the executor's:

1. **`csv-examples/` is committed and may contain real bank statements** (the ignore entry was corrupted before it ever took effect — see Task 1). Options: (a) keep as-is; (b) `git rm -r --cached csv-examples` so it stays on disk but leaves the index (history still contains it); (c) scrub from history if the data is sensitive. **Recommend at least (b).**
2. **`theme-sketches/`** (15 committed HTML design mockups): keep as design reference, or delete now that the theme shipped. **Recommend keeping** — low cost, useful provenance.
3. **`.planning/debug/`, `.planning/forensics/`, `.planning/temp.json`** (committed GSD working artifacts; `temp.json` duplicates GSD config): delete from the repo, or leave. **Recommend deleting `temp.json`**; debug/forensics are harmless but deletable.

---

## Completion criteria

- `npx eslint .` → 0 problems (from 289)
- `npx tsc --noEmit` → clean
- `npx vitest run` → all green
- `.gitattributes` + `.editorconfig` present; `git add --renormalize .` shows nothing new
- 9 atomic commits, each independently revertable
