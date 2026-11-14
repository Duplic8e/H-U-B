# Phone layout rules

Ledger's desktop layout was designed; its phone layout used to be the desktop
grid stacked into one column. These rules are the phone design. Every new page,
card or list follows them, and each rule names the guard that holds it.

"Phone" means the `desktop` variant does not match: narrower than 768px or
shorter than 500px. In code that is `useIsDesktop() === false`, and in class
names the `desktop:` prefix marks desktop-only styles.

## 1. The top bar names the page and holds its main action

Pages render their header through `PageHeader` (`src/components/ui/PageHeader.tsx`).
On a phone the title and the one main action (`phoneAction`, a `TopBarAction`)
move into the top bar, replacing the Ledger mark. Subtitles are desktop only.
The page's `<h1>` stays in `<main>`, visually hidden, so the outline and skip
link do not change. The phone action is a soft tinted circle (a 34px visual in a
44px hit area) and keeps the desktop button's accessible name.

A planner tool page (`PlannerTool`) has no page title to name, so its top bar
slot holds a Back button and the tool switcher, which shows the tool name. The
breadcrumb header is dropped on a phone and an `sr-only` `<h1>` stays in
`<main>`.

Secondary controls (a month stepper, an import button) are chrome, not content:
they sit in one compact row at the top of the page, never in the top bar, with
no card around them and icon-only buttons where the icon is clear. Each keeps a
44px hit area.

Guards: `e2e/mobile-guards.spec.ts`, "names itself in the top bar", "a planner
tool names itself in the top bar and frees the first screen", "budgeting phone
controls row is compact and keeps 44px tap targets" and "budgeting phone
controls stay inside the page after stepping to another month".

## 2. Switching pages starts at the top

`<main>` is the scroll container, so the browser does not reset it between
routes. Layout resets it on every pathname change. A tab change inside a page
(`?tab=`) does not reset it.

Guard: `e2e/mobile-guards.spec.ts`, "switching tabs starts the new page at the top".

## 3. Each page leads with its one key number

| Page | Key figure | Element |
| --- | --- | --- |
| Dashboard | Net worth | `DashboardMobile` net worth card headline |
| Budgeting | This period's net change | `MonthlySummaryWidget` Net Change |
| Investments (Portfolio tab) | Portfolio value | `PortfolioSummary` headline |
| Compensation | Total compensation | `CompensationMobile` figure beside the donut |
| Planner index | None: it is a menu | |

The element carries `data-key-figure`. On a portrait phone it must end above
the bottom 60px of the first screen without scrolling. Landscape phones are
scroll-first and exempt.

Guard: `e2e/mobile-guards.spec.ts`, "shows its key figure in the first screen".

## 4. Lists never scroll inside the page

A scroll area inside a scrolling page traps the thumb. On a phone a list inside
a card shows its first `PHONE_LIST_LIMIT` (5) items and a "Show all N" button.
Holdings show `PHONE_HOLDINGS_LIMIT` (8) per account. Here "phone" means
below the `wide` breakpoint (912px), which includes tablet portrait. A list only one item over
its cap is shown whole, because a button that reveals one row costs more space
than the row. Use `useShowMore` (`src/hooks/useShowMore.ts`) and
`ShowMoreButton` (`src/components/ui/ShowMoreButton.tsx`).

Desktop keeps its fixed-height scroll lists: there the cards sit side by side
and must line up.

Two exceptions scroll by design. A phone tab strip (rule 8) may scroll sideways
when its labels do not fit. A phone sheet opened with `scrollCue` (the tool
switcher and search) scrolls inside the sheet, with a bottom fade instead of a
scrollbar (rule 9).

Guard: `e2e/mobile-guards.spec.ts`, "has no list that scrolls inside the page".

## 5. Empty cards take one line

An empty account-group card on the Dashboard, on a phone, is its title, its
add action, and one sentence. No illustration, no zero total, no second add
button. Page-level empty states are the exception: an empty Portfolio, an empty
Package Details card on Compensation, and an empty Journal keep a labelled add
button, because the top-bar action on a phone is only an icon.

## 6. Charts read at 375px

At 375px every chart label is at least 12px and no two labels overlap. A chart
that would draw more than about six labelled categories down one side groups
the smallest into "Other" on a phone (`foldSmallest` in
`src/utils/budget/foldSmallest.ts`). The accessible description still reports
the real counts.

Guards: `e2e/mobile-guards.spec.ts`, "no chart text escapes the document
viewport" and "a chart reveals its values on tap".

## 7. Rows, not cards, for repeated records

A repeated record on a phone (a holding; below the `wide` breakpoint, 912px,
so tablet portrait too) is one row: identity on the left, the
number that matters on the right, everything else one tap away behind a
disclosure. A record should cost about 56px, not 220px.

## 8. Tabs are underline tabs

On a phone a tab strip (`Tabs`, `src/components/ui/Tabs.tsx`) is a row of
underline tabs, not bordered buttons that read as actions. The tabs share one row
and fill its width, each keeps a 44px tap target, and selecting one never makes
the document scroll sideways. If the labels do not fit, the strip scrolls
sideways and fades at the edge. The roving tabindex and arrow-key behaviour stay
as they are on desktop.

Guards: `e2e/mobile-guards.spec.ts`, "budgeting tabs are one row of underline
tabs" and "investments tabs are one row of underline tabs";
`e2e/desktop-guards.spec.ts`, "tab strips are real tabs and survive a reload".

## 9. Phone sheets

A phone sheet is the bottom sheet from `Sheet` (`src/components/ui/Sheet.tsx`).

- **No visible X.** It dismisses by swiping down, tapping the scrim, and Escape.
  Assistive technology and keyboard users get a Close button that is the first
  focusable in the sheet. It is `sr-only` until it takes focus, then a normal 44px
  control with the focus ring. `showClose` is only for a sheet with no other way
  out. A new sheet needs no close control of its own on a phone: callers' desktop
  header buttons are `hidden desktop:flex`.
- **The title is not sticky.** A pinned title costs screen height all the way down
  a long sheet, so it scrolls away with the content. The drag handle stays pinned
  and the top edge fades once the sheet has scrolled.
- **`scrollCue` sheets** hide the scrollbar and fade at the bottom while more
  content lies below. The search sheet also drops the esc hint and keeps its field
  pinned.
- **Focus enters the sheet.** On open, focus moves to the first visible control
  (never the hidden Close button, and never a text field, which would raise the
  keyboard), else to the panel. The Tab trap cycles over visible elements only: a
  `display:none` control cannot hold focus, and a trap that counts it loses focus
  to `<body>`. A sheet that already has focus inside it (the palette's field)
  keeps that focus.
- The Settings sheet follows one anatomy per section: a one-line description,
  44px buttons, and a footer that wraps.

Guards: `e2e/mobile-guards.spec.ts`, "phone sheets show no visible Close button
and still dismiss on Escape and scrim", "phone sheets give keyboard users a close
button that shows on focus only", "phone focus: Settings sheet takes focus on
open and Tab stays inside it", "phone focus: Add Transaction sheet takes focus on
open and Tab stays inside it", "phone sheet headers scroll away and leave room
under the handle", "a scrolled phone sheet softens its top edge and keeps the
handle pinned", "the search sheet has no esc hint, visible close button or
scrollbar and keeps its input", "the planner tool sheet has no visible close row
or scrollbar and cues more below" and "the Settings sheet is organized: 44px
actions, centred Reminders row, nothing clipped".

## 10. No page scrollbar on phones

`<main>` hides its scrollbar on a phone (`.phone-no-scrollbar` in
`src/index.css`, scoped to the phone layout; `scrollCue` sheets reuse it). Scrolling
itself is unchanged. The
rule must stay out of the `desktop` variant, where the scrollbar is the only
cue that a page scrolls.

Guards: `e2e/mobile-guards.spec.ts`, "main has no visible scrollbar on a
phone"; `e2e/desktop-guards.spec.ts`, "main keeps its scrollbar on desktop".

## 11. Tool Overview is shown once, then waits below

Every planner tool has a Tool Overview sheet. On a phone it appears once per
tool as a dismissible "New Here? Read the Tool Overview" banner above the tool, and afterwards as a centered button
below the results (`PhoneToolPage`). Which tools have been seen is kept on the
device and is not backed up or synced. After the notice goes (Dismiss, or the
sheet opened from it closing) focus moves to the bottom button, which is always
present.

Guards: `e2e/mobile-guards.spec.ts`, "tool overview: first-visit notice, then
a centred button after the results" and "tool overview: focus returns to the
bottom button after the notice path closes".

## Deliberately not done

- **Document scroll on phones.** It would let iOS collapse the Safari address
  bar, but the installed app has no address bar, and `useScrollLock` freezes
  `body`, which iOS ignores for document scroll. Revisit only together with a
  scroll lock that works on iOS.
- **Floating add button, swipe between tabs, collapsing headers.** Declined in
  July 2026 and again in October 2026. Rule 1 covers reachability. "Collapsing
  headers" means page headers. A sheet title scrolling away with its content
  (rule 9) is by design and is not the same thing.
