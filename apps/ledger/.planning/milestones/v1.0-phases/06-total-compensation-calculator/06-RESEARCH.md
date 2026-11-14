# Phase 6: Total Compensation Calculator — Research

**Phase:** 06
**Written:** 2026-06-18
**Status:** Complete

---

## 1. Codebase Pattern Analysis

### Zustand Store Pattern (from `useProjectionStore.ts`, `useInvestmentStore.ts`)

Exact store structure used across the project:

```typescript
import { create } from 'zustand';

export interface SomeState {
  // data fields
  someField: number;
  // computed/derived (recalculated on each action)
  history: DerivedDataPoint[];
  // actions
  setSomeField: (value: number) => void;
}

export const useSomeStore = create<SomeState>((set) => ({
  someField: defaultValue,
  history: computeHistory(defaultValue),
  setSomeField: (someField) =>
    set((state) => ({
      someField,
      history: computeHistory(someField),
    })),
}));
```

**Key observations:**
- `create<StateType>()` with TypeScript generics — no `persist` middleware used in existing stores (no localStorage persistence used yet, but we should add it per CONTEXT.md D-01 guidance and codebase `useThemeStore.ts` which uses `persist`)
- Actions recompute derived data (history) inline on each mutation
- No `immer` middleware — pure object spread
- Stores export both the interface and the hook

### Recharts Pattern (from `InvestmentTrackerWidget.tsx`, `ProjectionWidget.tsx`)

CSS variable naming used in charts — two conventions observed:
- New convention: `var(--color-accent)`, `var(--color-text-secondary)`, `var(--color-border)`, `var(--color-bg-primary)`, `var(--color-bg-secondary)` (InvestmentTrackerWidget)
- Old convention: `var(--accent)`, `var(--text-secondary)`, `var(--border-color)`, `var(--bg-primary)`, `var(--bg-secondary)` (ProjectionWidget)

`index.css` confirms both work (aliased via `--color-*: var(--*)`). **Use the `--color-*` prefix convention** (newer, more explicit).

Standard chart boilerplate:
```tsx
<ResponsiveContainer width="100%" height="100%">
  <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} tickFormatter={formatCurrency} />
    <Tooltip
      contentStyle={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-primary)',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}
      itemStyle={{ color: 'var(--color-text-primary)' }}
      formatter={(value: number | string) => [
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value)), ''
      ]}
    />
    {/* chart series */}
  </ComposedChart>
</ResponsiveContainer>
```

### Modal Pattern (from `SetTargetModal.tsx`)

Exact modal structure:
```tsx
// Mount pattern: conditional render (not portal)
if (!isOpen) return null;

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md bg-[var(--color-bg-primary)] rounded-xl shadow-lg border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-[18px] font-semibold leading-[1.2] text-[var(--color-text-primary)]">Modal Title</h2>
        <button onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      {/* Body */}
      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
        {/* Label + input pattern */}
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">Field Label</label>
          <input
            type="number"
            className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          />
        </div>
        {/* Footer */}
        <div className="pt-2 mt-2 border-t border-[var(--color-border)]">
          <button type="submit" className="w-full py-3 bg-[var(--color-accent)] text-white rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity">
            Save
          </button>
        </div>
      </form>
    </div>
  </div>
);
```

**Key observations:**
- `fixed inset-0 z-50` backdrop with `bg-black/50`
- `max-w-md` width (can be extended to `max-w-2xl` for multi-section modal)
- Pixel-exact font sizes: `text-[18px]` heading, `text-[12px]` labels, `text-[14px]` body/inputs
- `focus:border-[var(--color-accent)] focus:outline-none` for input focus
- Submit button: `bg-[var(--color-accent)] text-white`

### WidgetWrapper Pattern

```tsx
<WidgetWrapper title="Widget Title" className="col-span-1 md:col-span-2" action={<SomeButton />}>
  {/* widget content */}
</WidgetWrapper>
```

`WidgetWrapper` renders: `bg-bg-secondary rounded-lg p-4 shadow-sm flex flex-col` — uses Tailwind direct classes (not `--color-*` vars).

### Preset Button Pattern (from `ProjectionWidget.tsx`)

```tsx
{[10, 20, 30].map((years) => (
  <button
    key={years}
    onClick={() => setHorizon(years as 10 | 20 | 30)}
    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
      horizon === years
        ? 'bg-accent text-bg-primary'
        : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
    }`}
  >
    {years} Years
  </button>
))}
```

### Page Structure (from `Budgeting.tsx`)

```tsx
export const SomePage: React.FC = () => (
  <div className="flex flex-col gap-6 w-full h-full p-6 animate-fade-in">
    <header className="flex justify-between items-center">
      <div>
        <h1 className="text-[24px] font-semibold text-text-primary">Page Title</h1>
        <p className="text-[14px] text-text-secondary mt-1">Subtitle description.</p>
      </div>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-X gap-6">
      {/* widgets */}
    </div>
  </div>
);
```

### App.tsx Route — Current State

`src/App.tsx` line 10: `const Compensation = () => <div className="p-4"><h2 className="text-2xl font-bold">Total Compensation</h2></div>`  
`src/App.tsx` line 35: `<Route path="compensation" element={<Compensation />} />`

**Integration:** Replace the inline `const Compensation` with an import from `src/pages/Compensation.tsx`. No route path change needed.

### Layout.tsx — Already Complete

`src/components/Layout.tsx` line 14: `{ name: 'Compensation', path: '/compensation', icon: Calculator }` — **already in nav**, no changes needed.

---

## 2. Data Model Design

### `useCompensationStore.ts` Interface

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VestingPreset = '4yr-1yr-cliff' | '3yr-no-cliff' | 'custom';
export type VestingFrequency = 'monthly' | 'quarterly';

export interface VestingSchedule {
  preset: VestingPreset;
  totalVestMonths: number;  // e.g. 48 for 4-year
  cliffMonths: number;      // e.g. 12 for 1-year cliff, 0 for no cliff
  frequency: VestingFrequency;
}

export interface RSUGrant {
  id: string;
  grantName: string;
  totalGrantValue: number;   // dollar value at grant
  vestingSchedule: VestingSchedule;
  grantStartDate: string;    // ISO: 'YYYY-MM-DD'
}

export interface CompensationPackage {
  id: string;
  name: string;
  baseSalary: number;
  cashBonusPercent: number;           // e.g. 10 = 10%
  esppContributionPercent: number;    // e.g. 10 = 10%
  esppDiscountPercent: number;        // e.g. 15 = 15%
  rrspMatchPercent: number;           // e.g. 5 = 5%
  rrspMatchCap: number;               // dollar cap, e.g. 5000
  rsuGrants: RSUGrant[];
}

export interface VestEvent {
  monthIndex: number;    // 0-based months from grant start
  label: string;         // e.g. "Month 12 (Cliff)"
  vestValue: number;     // dollar value vesting this event
  cumulativeVested: number;
}

interface CompensationState {
  primaryPackage: CompensationPackage;
  comparePackage: CompensationPackage | null;
  compareMode: boolean;
  
  setPrimaryPackage: (pkg: Partial<CompensationPackage>) => void;
  setComparePackage: (pkg: CompensationPackage | null) => void;
  toggleCompareMode: () => void;
  addRSUGrant: (grant: RSUGrant) => void;
  removeRSUGrant: (id: string) => void;
  updateRSUGrant: (id: string, updates: Partial<RSUGrant>) => void;
}
```

**Default primary package:**
```typescript
const defaultPackage: CompensationPackage = {
  id: 'primary',
  name: 'Current Offer',
  baseSalary: 0,
  cashBonusPercent: 0,
  esppContributionPercent: 0,
  esppDiscountPercent: 15,
  rrspMatchPercent: 0,
  rrspMatchCap: 0,
  rsuGrants: [],
};
```

**Use `persist` middleware** (pattern from `useThemeStore`) for localStorage persistence.

### Annualized Calculation Functions

```typescript
export function calcAnnualBonus(pkg: CompensationPackage): number {
  return pkg.baseSalary * (pkg.cashBonusPercent / 100);
}

export function calcAnnualESPP(pkg: CompensationPackage): number {
  // ESPP benefit = contribution * discount rate
  const contribution = pkg.baseSalary * (pkg.esppContributionPercent / 100);
  return contribution * (pkg.esppDiscountPercent / 100);
}

export function calcAnnualRRSP(pkg: CompensationPackage): number {
  const match = pkg.baseSalary * (pkg.rrspMatchPercent / 100);
  return Math.min(match, pkg.rrspMatchCap);
}

export function calcAnnualRSU(pkg: CompensationPackage): number {
  // Sum first-year vest events across all grants
  return pkg.rsuGrants.reduce((total, grant) => {
    const events = generateVestEvents(grant);
    const firstYearVests = events.filter(e => e.monthIndex <= 12);
    return total + firstYearVests.reduce((sum, e) => sum + e.vestValue, 0);
  }, 0);
}

export function calcTotalComp(pkg: CompensationPackage): number {
  return pkg.baseSalary + calcAnnualBonus(pkg) + calcAnnualESPP(pkg) + calcAnnualRRSP(pkg) + calcAnnualRSU(pkg);
}
```

### Vest Event Timeline Generator

```typescript
export function generateVestEvents(grant: RSUGrant): VestEvent[] {
  const { totalGrantValue, vestingSchedule: sched } = grant;
  const { totalVestMonths, cliffMonths, frequency } = sched;
  
  const freqMonths = frequency === 'quarterly' ? 3 : 1;
  const events: VestEvent[] = [];
  let cumulative = 0;
  
  // Cliff event
  if (cliffMonths > 0) {
    // 25% vests at cliff for 4yr/1yr standard
    const cliffPct = cliffMonths / totalVestMonths;
    const cliffValue = totalGrantValue * cliffPct;
    cumulative += cliffValue;
    events.push({
      monthIndex: cliffMonths,
      label: `Month ${cliffMonths} (Cliff)`,
      vestValue: cliffValue,
      cumulativeVested: cumulative,
    });
  }
  
  // Post-cliff vest events
  const postCliffMonths = totalVestMonths - cliffMonths;
  const postCliffValue = cliffMonths > 0
    ? totalGrantValue * ((totalVestMonths - cliffMonths) / totalVestMonths)
    : totalGrantValue;
  const vestCountPostCliff = Math.floor(postCliffMonths / freqMonths);
  const perEventValue = vestCountPostCliff > 0 ? postCliffValue / vestCountPostCliff : 0;
  
  for (let m = cliffMonths + freqMonths; m <= totalVestMonths; m += freqMonths) {
    cumulative += perEventValue;
    events.push({
      monthIndex: m,
      label: `Month ${m}`,
      vestValue: perEventValue,
      cumulativeVested: cumulative,
    });
  }
  
  return events;
}
```

### Monthly Cash Flow Data (for Plan 06-01)

```typescript
export interface MonthlyFlowPoint {
  month: string;           // 'Jan', 'Feb', ...
  baseSalary: number;      // baseSalary / 12
  bonus: number;           // full bonus in one month (Q4 = December)
  espp: number;            // benefit spread equally
  rrsp: number;            // match spread equally
  rsu: number;             // vest events in that month
}
```

Generate 12 months. Bonus paid in month 12 (December) for simplicity, or let user configure.

---

## 3. Recharts Chart Design — Plan 06-01 (Base Comp & Bonus)

### Donut Chart (PieChart with innerRadius)

```tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Data derived from calcAnnualized*() functions
const COMP_COLORS = {
  baseSalary:  'var(--color-accent)',
  cashBonus:   '#10b981',  // emerald-500
  espp:        '#f59e0b',  // amber-500
  rrsp:        '#8b5cf6',  // violet-500
  rsu:         '#06b6d4',  // cyan-500
};

<ResponsiveContainer width="100%" height={280}>
  <PieChart>
    <Pie
      data={pieData}
      cx="50%"
      cy="50%"
      innerRadius={70}
      outerRadius={110}
      paddingAngle={3}
      dataKey="value"
    >
      {pieData.map((entry, index) => (
        <Cell key={index} fill={entry.color} />
      ))}
    </Pie>
    <Tooltip
      formatter={(value: number) => [
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value),
        ''
      ]}
      contentStyle={{ backgroundColor: 'var(--color-bg-primary)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
    />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

Hero number overlay: position `absolute` centered in donut hole with total comp value (text-[28px] font-semibold).

### Monthly Cash Flow BarChart

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={200}>
  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
    <YAxis tickFormatter={(v) => `$${v/1000}k`} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
    <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, '']} contentStyle={{ backgroundColor: 'var(--color-bg-primary)', borderColor: 'var(--color-border)', borderRadius: '8px' }} />
    <Bar dataKey="baseSalary" stackId="a" fill="var(--color-accent)" name="Base Salary" />
    <Bar dataKey="bonus" stackId="a" fill="#10b981" name="Bonus" />
    <Bar dataKey="espp" stackId="a" fill="#f59e0b" name="ESPP" />
    <Bar dataKey="rrsp" stackId="a" fill="#8b5cf6" name="RRSP" />
    <Bar dataKey="rsu" stackId="a" fill="#06b6d4" name="RSU" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

## 4. Recharts Chart Design — Plan 06-02 (Equity Vesting)

### RSU Vesting Timeline ComposedChart

```tsx
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

// vestEvents: VestEvent[] from generateVestEvents()
// Filter to show only months with vest events + cliff marker

<ResponsiveContainer width="100%" height={280}>
  <ComposedChart data={vestEvents} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
    <XAxis dataKey="monthIndex" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} tickFormatter={(v) => `M${v}`} />
    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} tickFormatter={(v) => `$${v/1000}k`} />
    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} tickFormatter={(v) => `$${v/1000}k`} />
    <Tooltip
      formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
      contentStyle={{ backgroundColor: 'var(--color-bg-primary)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
    />
    {/* Cliff marker — ReferenceLine at cliffMonths */}
    <ReferenceLine
      yAxisId="left"
      x={cliffMonths}
      stroke="#ef4444"
      strokeDasharray="4 4"
      label={{ value: 'Cliff', position: 'top', fill: '#ef4444', fontSize: 11 }}
    />
    <Bar yAxisId="left" dataKey="vestValue" name="Vest Event" fill="var(--color-accent)" opacity={0.7} radius={[3, 3, 0, 0]} />
    <Line yAxisId="right" type="monotone" dataKey="cumulativeVested" name="Cumulative" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
  </ComposedChart>
</ResponsiveContainer>
```

**Note:** `ReferenceLine` with `x={cliffMonths}` requires the cliff month value to exist in the data array's `monthIndex` field — it uses the categorical x-axis, so we need the cliff event in the data.

---

## 5. Compare Mode Design (D-06)

**State approach:** Store `comparePackage: CompensationPackage | null` + `compareMode: boolean` in Zustand (same store). Simple toggle.

**Delta computation:**
```typescript
interface ComponentDelta {
  label: string;
  primary: number;
  compare: number;
  delta: number;
}

function computeDeltas(primary: CompensationPackage, compare: CompensationPackage): ComponentDelta[] {
  return [
    { label: 'Base Salary', primary: primary.baseSalary, compare: compare.baseSalary, delta: primary.baseSalary - compare.baseSalary },
    { label: 'Cash Bonus', primary: calcAnnualBonus(primary), compare: calcAnnualBonus(compare), delta: calcAnnualBonus(primary) - calcAnnualBonus(compare) },
    { label: 'ESPP Benefit', primary: calcAnnualESPP(primary), compare: calcAnnualESPP(compare), delta: calcAnnualESPP(primary) - calcAnnualESPP(compare) },
    { label: 'RRSP Match', primary: calcAnnualRRSP(primary), compare: calcAnnualRRSP(compare), delta: calcAnnualRRSP(primary) - calcAnnualRRSP(compare) },
    { label: 'RSU (Annual)', primary: calcAnnualRSU(primary), compare: calcAnnualRSU(compare), delta: calcAnnualRSU(primary) - calcAnnualRSU(compare) },
    { label: 'Total Comp', primary: calcTotalComp(primary), compare: calcTotalComp(compare), delta: calcTotalComp(primary) - calcTotalComp(compare) },
  ];
}
```

**Delta badge rendering:**
```tsx
const deltaClass = delta > 0 ? 'text-emerald-600 bg-emerald-50' : delta < 0 ? 'text-red-500 bg-red-50' : 'text-text-secondary bg-bg-secondary';
const deltaLabel = delta > 0 ? `+$${Math.abs(delta).toLocaleString()} more` : delta < 0 ? `−$${Math.abs(delta).toLocaleString()} less` : 'Equivalent';
```

(Map to Tactical theme via dark mode variants: `dark:text-emerald-400 dark:bg-emerald-950/30`)

---

## 6. File Structure

### New files to create

```
src/
├── store/
│   └── useCompensationStore.ts          [NEW] — Zustand store for all compensation state
├── pages/
│   └── Compensation.tsx                  [NEW] — Main compensation page
└── components/
    └── compensation/
        ├── CompHeroWidget.tsx             [NEW] — Hero number + donut chart + view toggle (Plan 06-01)
        ├── CompensationModal.tsx          [NEW] — Multi-section modal for all comp inputs (Plan 06-01)
        ├── VestingPresetBar.tsx           [NEW] — Preset quick-select buttons (Plan 06-02)
        ├── EquityVestingWidget.tsx        [NEW] — RSU timeline ComposedChart (Plan 06-02)
        └── CompareView.tsx               [NEW] — Delta comparison list + compare input form (Plan 06-02)
```

### Files to modify

```
src/
├── App.tsx                              [MODIFY] — Replace inline Compensation const with import from pages/Compensation.tsx
```

`src/components/Layout.tsx` — **No change needed** (Compensation nav link already exists at line 14).

---

## 7. Integration Points

### App.tsx Change

Replace line 10:
```typescript
// Before:
const Compensation = () => <div className="p-4"><h2 className="text-2xl font-bold">Total Compensation</h2></div>

// After:
import { Compensation } from './pages/Compensation'
```

Remove the inline const and use the imported component at the existing route (line 35 — route path stays as `"compensation"`).

### Compensation.tsx Page Layout

Following `Budgeting.tsx` structure:
```tsx
export const Compensation: React.FC = () => (
  <div className="flex flex-col gap-6 w-full h-full p-6 animate-fade-in">
    <header className="flex justify-between items-center">
      <div>
        <h1 className="text-[24px] font-semibold text-text-primary">Total Compensation</h1>
        <p className="text-[14px] text-text-secondary mt-1">Break down and visualize your employment compensation.</p>
      </div>
      <button onClick={() => setModalOpen(true)}>Add Compensation Package</button>
    </header>
    
    {/* Bento Grid: hero spans 2 cols, components fill remaining */}
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <CompHeroWidget className="lg:col-span-2" />       {/* Plan 06-01 */}
      <BaseSalaryCard />                                   {/* inline, Plan 06-01 */}
      <CashBonusCard />                                    {/* inline, Plan 06-01 */}
      <ESPPCard />                                         {/* inline, Plan 06-01 */}
      <RRSPCard />                                         {/* inline, Plan 06-01 */}
    </div>
    
    {/* Equity section */}
    <EquityVestingWidget />                                {/* Plan 06-02 */}
    
    {/* Compare mode */}
    {compareMode && <CompareView />}                       {/* Plan 06-02 */}
    
    <CompensationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
  </div>
);
```

---

## Validation Architecture

### Build Validation
```bash
npm run build
```
- Must exit 0 with no TypeScript errors
- `npx tsc --noEmit` for type-only check

### Functional Test Scenarios

**Plan 06-01:**
1. Navigate to `/compensation` — page renders (no blank screen)
2. Empty state shows: `"No Compensation Data Yet"` heading
3. Click "Add Compensation Package" — `CompensationModal` opens
4. Enter: Base Salary=$100,000, Cash Bonus=10%, RRSP=5%/$5,000 cap — Save
5. Hero displays `$105,000` (base + bonus, no RSU/ESPP)
6. Donut chart updates: Base=95.2%, Bonus=4.8% of non-RRSP total
7. Toggle to "Monthly Cash Flow View" — bar chart shows $8,333/mo base, $10,000 in Dec (bonus)
8. RRSP Match shows $5,000 (min of 5% of $100k = $5k, cap $5k)

**Plan 06-02:**
1. "Add RSU Grant" — opens grant form within modal
2. Enter: Grant=$100,000, 4-Year/1-Year Cliff preset, quarterly vest
3. Vesting chart renders: Month 12 cliff bar=$25,000 (25% of $100k), quarters at $6,250/event
4. ReferenceLine appears at month 12 with label "Cliff"
5. Cumulative line reaches $100,000 at month 48
6. "Compare Another Offer" button visible — click opens simplified input
7. Enter compare base=$90,000 — delta shows `+$15,000 more` in green for total comp

### Visual Verification
- Geometric theme: white background, blue accent, Inter font
- Tactical theme: dark background, green accent, JetBrains Mono font
- All chart colors adapt via CSS variables on theme switch
- Modal closes on Escape key press and backdrop click

---

## RESEARCH COMPLETE
