# Phase 3: Budgeting Module - Research

## Architecture and Current State

### Component Structure
The project uses `WidgetWrapper` (in `src/components/dashboard/WidgetWrapper.tsx`) to encapsulate widgets. These wrappers provide consistent padding, a title, and a context menu button.
Widgets created so far (`AssetsWidget`, `DebtsWidget`, `NetWorthWidget`) reside in `src/components/dashboard/widgets/` and render their own specific data by reading from `useDashboardStore`.

### State Management
The project uses `zustand` for state management. Currently, `src/store/useDashboardStore.ts` holds `DashboardState` (`netWorth`, `totalAssets`, `totalDebts`, etc.).
For the Budgeting Module, we will need to expand this store (or create a dedicated `useBudgetStore`) to manage:
- A list of categorized expenses (e.g., `id`, `amount`, `category`, `date`, `description`)
- A list of income entries
- Derived values: `monthlyCashFlow`, `totalIncome`, `totalExpenses`

### Phase Requirements & Decisions
- **BUDGET-01**: Monthly cash flow tracking widget.
- **BUDGET-02**: Income tracking widget.
- **BUDGET-03**: Categorized expense tracking widget.
- **D-01**: Use a dedicated modal overlay for entering income and expenses to keep widgets clean and read-only.
- **D-02**: Use fixed standard categories (Housing, Food, Transport, etc.).
- **D-03**: Default to tracking calendar month.

## Validation Architecture

### 1. Data Entry Validation (D-01)
- The modal overlay must correctly capture `amount`, `category` (from a fixed list), and `date`.
- Modals must be capable of dispatching to the Zustand store.

### 2. State & Calculation Validation (BUDGET-01, BUDGET-02, BUDGET-03)
- The `zustand` store must correctly aggregate total income and total expenses for the current month.
- Cash flow must be calculated as `totalIncome - totalExpenses`.

### 3. UI Validation
- The three new widgets must be implemented using `WidgetWrapper` and integrated into the existing `BentoGrid` or main dashboard layout.
- The UI must reflect the "Tactical Monospace and Geometric Abstraction" dual-theme rules.
