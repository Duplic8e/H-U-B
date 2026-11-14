# Phase 02: master-dashboard-layout - Research

## Architectural Approach
We need to implement a Bento Grid layout. We can use CSS Grid to create a responsive, high-density layout. We'll define a set of grid template areas or a dynamic column system that allows widgets to span multiple rows/columns.

## Key Technical Decisions
- **Bento Grid System:** Use Tailwind CSS Grid (`grid-cols-1` mobile, `grid-cols-2` tablet, `grid-cols-3` or `grid-cols-4` desktop) to structure the widgets. We'll define utility classes for components to span multiple rows/columns (`col-span-2`, `row-span-2`) for the Bento effect.
- **Mock Data Store:** Since we don't have a backend yet, we'll implement a mock data structure or a Zustand store (`useDashboardStore.ts`) for Net Worth, Assets, and Debts to populate the widgets.
- **Widget Components:** Create reusable widget wrapper components (`WidgetWrapper.tsx`) with standardized titles and action menus as specified in D-03.
- **Theming Integration:** Ensure the Bento Grid and widgets consume the active theme variables for backgrounds, borders, and text colors (Tactical vs Geometric).

## Validation Architecture
- Verify that the Dashboard view renders at `/`.
- Verify the Bento Grid responds to screen size changes and maintains visual hierarchy.
- Ensure all required widgets (Net Worth, Assets, Debts) are rendered with mock data.
- Ensure Widget Header and Action Menus are present across all widgets.

## File System Changes
- `src/components/dashboard/BentoGrid.tsx`
- `src/components/dashboard/WidgetWrapper.tsx`
- `src/components/dashboard/widgets/NetWorthWidget.tsx`
- `src/components/dashboard/widgets/AssetsWidget.tsx`
- `src/components/dashboard/widgets/DebtsWidget.tsx`
- `src/pages/Dashboard.tsx`
- `src/store/useDashboardStore.ts`
