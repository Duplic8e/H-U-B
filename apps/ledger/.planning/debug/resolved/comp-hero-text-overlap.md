---
status: resolved
trigger: "the total annual compensation text goes on top of the chart again after your latest debug"
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: comp-hero-text-overlap

## Context
**Trigger**: 
When reducing the pie chart radii to fix the clipping labels on the outer edges, the inner hole diameter was inadvertently shrunk too much. As a result, the large, bold "Total Annual Compensation" text in the center overlapped the inner edges of the pie slices.

## Resolution
**Fix applied**: 
- Reverted the pie chart's `innerRadius` and `outerRadius` back to `110` and `135` respectively. This restores a large `220px` central opening that comfortably accommodates the large central total text.
- To prevent the outer labels from clipping (which was the original problem), the container's height was expanded to `400px`, and an explicit `margin={{ top: 30, right: 30, bottom: 30, left: 30 }}` was added to the `<PieChart>` component. This forces the chart to render further away from the absolute edges of the box, ensuring that labels always have plenty of room to render without being cut off.

**Files changed**: 
- `src/components/compensation/CompHeroWidget.tsx`
