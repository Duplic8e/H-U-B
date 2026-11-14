# Phase 4: Investment Tracker - Plan

**Phase**: 4
**Goal**: Visual comparison of target vs actual investments using Recharts.

## 04-01: Install Recharts & Base Structure

**Requirements**:
- Install `recharts` for charting.
- Establish `useInvestmentStore` to hold investment target and actuals.

**Tasks**:
- `[ ]` 1. Run `npm install recharts` in the project root.
- `[ ]` 2. Create `src/store/useInvestmentStore.ts`. Define state with an array of monthly snapshots (`date`, `actualBalance`, `targetBalance`) and an action `setTarget(newTarget: number)`. Add some initial mock data for the current year.

## 04-02: Investment Tracker Widget & Modal

**Requirements**:
- Build a widget displaying a `ComposedChart` using Recharts.
- Build a Set Goal modal.
- Integrate into `Dashboard.tsx`.

**Tasks**:
- `[ ]` 1. Create `src/components/investments/SetTargetModal.tsx`. It should be a modal containing an input field to set the overall target goal, styled to match the dark/light premium theme.
- `[ ]` 2. Create `src/components/investments/InvestmentTrackerWidget.tsx`. This should render a card containing a Recharts `ResponsiveContainer` and `ComposedChart`. Map `targetBalance` to a `Line` and `actualBalance` to an `Area`. Use native CSS variables (`var(--color-primary)`) for colors to ensure theme reactivity. Include a "Set Goal" button that triggers `SetTargetModal`.
- `[ ]` 3. Modify `src/pages/Dashboard.tsx` to import and render `InvestmentTrackerWidget` inside the `BentoGrid`.
- `[ ]` 4. Ensure responsiveness and proper rendering in both Tactical and Geometric themes.
