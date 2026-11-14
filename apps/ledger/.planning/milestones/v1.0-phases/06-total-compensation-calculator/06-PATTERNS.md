# Phase 6 — Pattern Map

**Phase:** 06 — Total Compensation Calculator
**Generated:** 2026-06-18

---

## Files To Be Created/Modified

| File | Role | Analog |
|------|------|--------|
| `src/store/useCompensationStore.ts` | Zustand store | `src/store/useProjectionStore.ts`, `src/store/useThemeStore.ts` |
| `src/pages/Compensation.tsx` | Page container | `src/pages/Budgeting.tsx` |
| `src/components/compensation/CompHeroWidget.tsx` | Hero + donut chart widget | `src/components/investments/InvestmentTrackerWidget.tsx` |
| `src/components/compensation/CompensationModal.tsx` | Multi-section modal | `src/components/investments/SetTargetModal.tsx` |
| `src/components/compensation/EquityVestingWidget.tsx` | ComposedChart widget | `src/components/investments/InvestmentTrackerWidget.tsx` |
| `src/components/compensation/CompareView.tsx` | Delta list component | `src/components/budget/IncomeWidget.tsx` |
| `src/App.tsx` | Route registration | current file |

---

## Analog Code Excerpts

### Zustand Store With `persist` — `useThemeStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'geometric',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'financial-dashboard-theme' }
  )
)
```

**Use this exact pattern** for `useCompensationStore.ts`. Key difference from simpler stores: `create<Type>()( persist(...) )` — note the extra `()` wrapper.

### Zustand Store With Derived Data — `useProjectionStore.ts`

```typescript
export const useProjectionStore = create<ProjectionState>((set) => ({
  horizon: 30,
  monthlyContribution: 1000,
  history: calculateHistory(30, 1000, 10, 3),

  setHorizon: (horizon) =>
    set((state) => ({
      horizon,
      history: calculateHistory(horizon, state.monthlyContribution, state.marketReturn, state.inflation),
    })),
}));
```

**Pattern:** Every mutation action recomputes derived data (history) inline. For `useCompensationStore`, exported helper functions (`calcTotalComp`, `generateVestEvents`) must be pure functions callable from both actions and components.

### WidgetWrapper Usage — `InvestmentTrackerWidget.tsx`

```tsx
<WidgetWrapper
  title="Investment Tracker"
  className="col-span-1 md:col-span-2 lg:col-span-2 min-h-[300px]"
  action={<button className="flex items-center gap-1 text-[12px] font-medium text-accent hover:opacity-80 transition-opacity">...</button>}
>
  <div className="h-[250px] w-full mt-4">
    <ResponsiveContainer width="100%" height="100%">
      ...
    </ResponsiveContainer>
  </div>
</WidgetWrapper>
```

**Use `--color-*` CSS variable convention** (not bare `var(--accent)`):
- `var(--color-accent)` ✓
- `var(--color-text-secondary)` ✓  
- `var(--color-border)` ✓
- `var(--color-bg-primary)` ✓
- `var(--color-bg-secondary)` ✓

### Recharts ComposedChart — `InvestmentTrackerWidget.tsx`

```tsx
<ComposedChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} dy={10} />
  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} dx={-10} />
  <Tooltip
    contentStyle={{
      backgroundColor: 'var(--color-bg-primary)',
      borderColor: 'var(--color-border)',
      color: 'var(--color-text-primary)',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}
    itemStyle={{ color: 'var(--color-text-primary)' }}
    formatter={(value: number | string) => [`$${Number(value).toLocaleString()}`, '']}
    labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}
  />
  <Area type="monotone" dataKey="actualBalance" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorActual)" strokeWidth={2} />
  <Line type="monotone" dataKey="targetBalance" stroke="var(--color-text-secondary)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
</ComposedChart>
```

**For EquityVestingWidget:** Replace `Area` with `Bar` and add `Line` for cumulative + `ReferenceLine` for cliff marker.

### Preset Buttons — `ProjectionWidget.tsx`

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

**For `VestingPresetBar`:** Replace `[10, 20, 30]` with vesting presets array: `[{ id: '4yr-1yr-cliff', label: '4-Year with 1-Year Cliff' }, ...]`

### Modal Pattern — `SetTargetModal.tsx`

```tsx
if (!isOpen) return null;

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md bg-[var(--color-bg-primary)] rounded-xl shadow-lg border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-[18px] font-semibold leading-[1.2] text-[var(--color-text-primary)]">Title</h2>
        <button onClick={onClose} className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">Field Label</label>
          <input
            type="number"
            className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          />
        </div>
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

**For `CompensationModal`:** Extend `max-w-md` to `max-w-2xl`. Add tabbed sections (Base & Cash → Equity → Benefits) — each tab is a `<div>` toggled by state.

### Page Structure — `Budgeting.tsx`

```tsx
export const Budgeting: React.FC = () => (
  <div className="flex flex-col gap-6 w-full h-full p-6 animate-fade-in">
    <header className="flex justify-between items-center">
      <div>
        <h1 className="text-[24px] font-semibold text-text-primary">Budgeting Module</h1>
        <p className="text-[14px] text-text-secondary mt-1">...</p>
      </div>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* widgets */}
    </div>
  </div>
);
```

**For `Compensation.tsx`:** Same structure with `grid-cols-1 lg:grid-cols-4` for Bento Grid. Add header button for "Add Compensation Package".

### Selector Pattern — `IncomeWidget.tsx`

```typescript
const transactions = useBudgetStore((state) => state.transactions);
```

**For compensation components:** Use selective subscriptions to avoid re-renders:
```typescript
const primaryPackage = useCompensationStore((state) => state.primaryPackage);
const compareMode = useCompensationStore((state) => state.compareMode);
```

### App.tsx Route Registration — Current State

```typescript
// line 10 — REPLACE THIS:
const Compensation = () => <div className="p-4"><h2 className="text-2xl font-bold">Total Compensation</h2></div>

// Replace with top-of-file import:
import { Compensation } from './pages/Compensation'
```

Route at line 35 (`<Route path="compensation" element={<Compensation />} />`) stays unchanged.

---

## PATTERN MAPPING COMPLETE
