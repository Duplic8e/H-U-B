---
status: resolved
trigger: "the calendar in rsu grant doesnt match the theme, the rsu grants, the presets don't have the frequency (monthly quarterly etc)"
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: rsu-modal-calendar-frequency-fix

## Context
**Trigger**: 
1. Native browser `<input type="date">` calendars were displaying in light mode even when the application was in the "Tactical" dark theme.
2. The Vesting Frequency selection (Monthly/Quarterly) was hidden when selecting schedule presets, preventing users from customizing the payout frequency of standard 3/4-year schedules.

## Resolution
**Fix applied**: 
- **Calendar Theming**: Added `color-scheme: dark;` to the `[data-theme='tactical']` class in `src/index.css`. This signals to the browser's native rendering engine to use dark mode styling for built-in popups and form controls, instantly fixing the calendar appearance.
- **Frequency Selection**: Moved the Frequency `<select>` dropdown out of the custom schedule block and placed it globally next to the "Vesting Schedule" label. Modified the preset logic so selecting a preset defines the total length and cliff, but respects the user's chosen frequency.

**Files changed**: 
- `src/index.css`
- `src/components/compensation/CompensationModal.tsx`
