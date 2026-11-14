---
status: resolved
trigger: When I go to Investments, I don't see the investments related stuf, when I go to Projections, I don't see the projections related stuff, and when I go to Compensation I don't see the compensation realted stuff
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: app-routing-missing-pages

## Context
**Trigger**: When I go to Investments, I don't see the investments related stuff, when I go to Projections, I don't see the projections related stuff, and when I go to Compensation I don't see the compensation related stuff.

## Resolution
**Root Cause**: `App.tsx` was using inline dummy components for the `/investments`, `/projections`, and `/compensation` routes instead of importing the actual page components. `Investments` and `Projections` did not have dedicated page wrappers, they were only built as widgets.
**Fix applied**: Created `src/pages/Investments.tsx` and `src/pages/Projections.tsx` to wrap the respective widgets. Updated `App.tsx` to import and render `Investments`, `Projections`, and `Compensation` pages.
**Files changed**: 
- `src/App.tsx`
- `src/pages/Investments.tsx`
- `src/pages/Projections.tsx`
