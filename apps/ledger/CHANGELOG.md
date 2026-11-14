# Changelog

All notable changes to Ledger are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
pre-1.0 beta.

## [Unreleased]

### Changed
- Budgeting is reorganized into three tabs with one job each. This Month shows In, Out, Net and Saved, then what needs attention, your budget, this month's bills and the Expense and Income chart. Transactions holds the list, review and excluded imports. Plan holds the Cash Plan, targets, categories and rules (it was called Setup).
- Insights is no longer a tab: it is one tap from the bottom of This Month, and now also holds the Cash Flow chart and Savings Rate.
- One Needs Attention card replaces the separate banners. It lists this month's import, how many transactions are waiting to be categorized and how many need review, and disappears when there is nothing to do. It also appears on the Dashboard in a shorter form.
- A Bills card on This Month shows each monthly bill as paid or still due, unpaid first, with what is left to pay.
- Projected Net on Budgeting now counts unpaid bills, so it matches the Dashboard.

### Added
- Cash Plan on Budgeting → Overview ties the sections together: salary from Compensation, less estimated tax, CPP and EI, less your ESPP contribution, gives take-home; recurring bills and the rest of your budget targets come out of that, leaving what is left over or short. One menu restates every line weekly, biweekly, monthly or yearly.
- Recurring bills: add rent, phone, insurance or anything on a schedule in the Cash Plan, with an amount, how often, the day it is due and an optional budget category. A bill filed under a category is not counted a second time against that category's target.
- Unpaid recurring bills now count in this month's Projected Net until a matching transaction is imported.
- An ESPP section on Compensation: contribution and discount percent, the day you enrolled, the enrollment period in months, the lookback price and the purchase price that locked. It shows what comes off pay per month and year, the price you are buying at, the gain at today's price, when the period ends and the time left. Edits save as you type.
- A monthly import reminder: from the 1st of each month until you import, the Dashboard and Budgeting show "Time to import". Remind Me on the 1st adds a repeating calendar event with an alert, and a notification is shown on opening the app when reminders are on.
- Sort the Categorize page by Newest, Oldest, Most Transactions, Largest Total or Store Name. The choice is remembered on this device.
- Restore All on Excluded Imports sends every excluded or ignored entry back to review at once, with Undo.
- On the Categorize page, Categorize Them Too moves transfers and card payments that were set aside into the queue, where they can be filed or marked Not Spending like any other store.
- Make a category while you categorize: the + beside each store (or + New Category in its picker) opens a sheet for the name and its group, existing or new, and files the store into it straight away.
- Rename categories and groups: the pencil beside each one in Setup → Categories on a phone, and beside each group on desktop.
- A Categorize page (Budgeting → "to categorize" → Start). Imported transactions are grouped by store, newest first, with a Last 3 Months or All switch. Pick a category once for a store and every transaction from it is filed, including older ones still waiting, and Ledger remembers the store, so later imports from it go straight into your budget. Pick One by One files a single transaction without teaching the store (for a store like Amazon), Not Spending leaves a transfer or payment out, and Undo takes back the whole choice, rule included.
- Learned rules now match the store, not the exact bank text: LOBLAWS #1234 TORONTO ON and LOBLAWS #5678 NORTH YORK ON are both Loblaws, and CIBC chequing prefixes such as "Point of Sale - Interac RETAIL PURCHASE" are ignored.
- The import summary says how many transactions were filed automatically.
- CIBC chequing and savings downloads (Date, Description, Debit, Credit, no header row) now import directly instead of asking you to map columns. Transfers between your own accounts and payments to your card are set aside so they are not counted as spending or income, and reversals, returns and corrections count as money back at that store.
- Store matching understands more CIBC wording: Visa Debit and branch prefixes are ignored, service charges, interest, ATM withdrawals and deposits each read as one entry, weekday stamps (LYFT *RIDE THU) are dropped, initials such as A. B. C. Group stay together, and a phone number where the city usually sits no longer swallows the store name.

### Changed
- A new iOS-style look. The six themes are replaced by Light and Dark in the colors of Apple's own apps, with the system font (San Francisco on iPhone), grouped white or dark cards on a grey background, large bold page titles and blue bar buttons. Settings → Appearance picks System, Light or Dark; System follows your iPhone, including the automatic switch at sunset. Every earlier theme choice moves to System.
- On iPhone the top bar now sits below the Dynamic Island and the status bar instead of under them, and the tab bar is translucent with the home indicator's space below it.
- No web fonts are downloaded any more, so the app opens faster.
- When Ledger is opened from the Hub, it backs itself up to the Hub's private data repo and shows a Back to Hub button in the top bar.

## [0.26.5-beta] - 2026-10-19

### Changed
- The Dashboard Net Worth Over Time empty state reads Not Enough History Yet with an Add History button, and drops its description line to match the other empty cards.
- On phones, the Import Holdings popup walks through three steps: pick the account, choose Replace, Update or Add (each with a line on what it does), then choose the file, with the supported brokers listed under the button. The name is now Title Case everywhere. Desktop is unchanged.
- On phones, the Dashboard This Month card shows the net beside its title, a bar of how much of the money in has gone out, then In and Out and the Projected Net. Desktop is unchanged.
- On phones, the Investments Portfolio tab leads with one card: the holdings value and all-time gain, Invested and Holdings, and an allocation bar you switch between Holding, Account and Currency, with the top five named and Show All Holdings for the rest. Holdings are one-line rows under an All, Gainers and Losers filter and a Sort button (Value, P/L, A to Z), each with its return as a pill and Price, Avg Cost, Book and P/L when tapped. The import time, exchange rates and Clear Portfolio sit in a closed fold at the bottom, and Clear Portfolio takes a second tap to confirm. Desktop is unchanged.
- On phones, the Investments Options tab shows Net P/L and Premium across open wheels in CAD, the three biggest premium earners, and a Stock Wheels, Puts and Closed switch with search and sort. Each ticker is one row; tap it for cost, premium, breakeven, an editable stock price, View Details and Copy. Add CSVs and Clear Data sit in a closed Manage fold. Desktop is unchanged.
- On phones, the Investments Trades tab leads with Realized, All Time and this year's figure, keeps Record a Trade in a closed fold with Buy and Sell as a switch, then lists Positions (with the Holding Says flag when a position disagrees with your holding) and the Trade Log grouped by month with Show All Trades. Desktop is unchanged.
- On phones, the Investments Plan vs Actual tab leads with Current Value, the gain since invested, and Planned and Invested, then one compact row per analysis with its planned amount against what is invested, its value and its return. Tap a row to open that analysis in a sheet with the Plan and Actual switch, its budget, the swap what-if and one-line position rows (tap one for the allocation, price, manual price, acted, buy lots and delete). Deleting an analysis or a position takes a second tap. Desktop is unchanged.
- On phones, the New Analysis popup has no title and stacks each ticker as a row with a slider and plus and minus buttons for its allocation, then Amount, Start Price (tap it to type one when the lookup finds none) and Shares. It shows how much of the budget is allocated, has Split Evenly, keeps Save Analysis pinned, and releases it while you type so the keyboard no longer hides the next ticker. The name field now reads "New Analysis Name (Defaults to Ticker)" on desktop too.
- In the Options detailed ledger, the last column is headed Net and the total reads Net Cash Flow.
- On phones, Savings Rate has its Rate, Trend and Split switch beside the title. Rate shows the gauge with Income, Spent and Saved under it, Trend shows the rate for each of the last six months, and Split shows saved against spent for each of them. Desktop is unchanged.
- On phones, Budget vs. Actual shows each category as a tile with what you spent, its target and a bar, two across and six before Show All. A category over its pace sits on a red tint instead of a pace label, and bills still read Paid or Due. Desktop is unchanged.
- On phones, the Budgeting Overview summary card lines up In, Out, Net and Saved in four equal centred columns, with Projected Net centred beneath, and now shows what you spent. Desktop is unchanged.
- On phones, the Budgeting Cash Flow chart is taller and each band carries its amount and its share of what came in, so the Salary and Savings figures read without tapping. Desktop is unchanged.

### Fixed
- Options tickers are shown in their own statement currency instead of a bare $: 005930.KS reads KRW and ₩ on the phone rows and in the detailed ledger, on desktop as well. Phone totals convert each ticker to CAD. The desktop Options cards still show $.

## [0.26.4-beta] - 2026-10-17

### Changed
- On phones, the Budgeting Insights tab leads with a Spending Alerts banner (tap it to compare each category with its usual spend) and a Coming Up card that groups the next 30 days of recurring charges by week with a total for each. All Recurring Charges (with the ignore and restore controls), Spending Calendar and Category Trends sit in folds below, each under one title. Desktop is unchanged.
- In Cash Flow, the Savings flow, bar and label are green in every theme (a new success colour that meets AA contrast), instead of the accent colour income uses.
- A category can be marked as a Bill. On phones, tap the ... on a category in Setup to open its options: Target Covers (One Month or One Year) and Payment (Auto, Bill or Everyday), with what each means behind an info button after Payment. A bill shows a Bill badge and is judged as Due, Paid or Over Budget instead of by pace, so a rent paid on the 1st no longer reads Over Pace. Auto treats a category as a bill when nearly all of its spending is monthly recurring payments; an annual category is a bill only when you mark it. On desktop the choice sits in the category row. The This Month's Budget pace pill on phones counts bills in full from the start of the month.
- On phones, Customize Dashboard lists the cards the Dashboard now has: Net Worth and This Month (one switch for all three month widgets), the five account groups, and the cards after them. Only those last cards have arrows, because the others always come first. The explanation sits behind an info icon after the title, which reads "Customize Dashboard".
- On phones, the Dashboard leads with Net Worth, then one This Month band (Money In, Money Out, Net and the Projected Net), then one fold per account group (Bank, Investment, Others, Receivables, Debts) with its total on the right, all folded until you tap one, with Add, Edit and Delete inside, instead of a separate card for each. Customize still applies: switching off Net Worth, the three month widgets together, or an account group removes it.
- On phones, Upcoming Vests shows the next vest with a countdown and its total, then the three dates after it, with grants that vest the same day combined.
- On phones, Portfolio shows the value, the all-time gain, and your best and weakest holding. How old the prices are sits behind an info button after the title, worded like "Stale Market Data (Last Updated: 21 Minutes Ago)".
- On phones, Top Goal shows the goal's name and percent, a progress bar, then Now, Left and Goal, with a View All link to the Forecaster and the explanation behind an info button.
- On phones, the Budgeting Overview leads with a donut of this period's expenses that switches to income with an Expense and Income switch under it, then In, Net and Saved, and the budget against each category (annual budgets included), before Cash Flow, Savings Rate and Owed to Me. Show All Categories is a full-width button.
- On phones, Budgeting has a Time Period button beside Import CSV that opens a sheet of This Month, Last Month, Last 3 Months, Last 6 Months, Last 12 Months and Year to Date; before, only the month arrows were there. The desktop period list is now Title Case too.
- In Savings Rate, the Trend and Split legends are centred, and the Trend legend reads Net Saved.
- On phones, This Month's Budget, Portfolio, Top Goal and Upcoming Vests empty cards read "No Transactions Available", "No Holdings Available", "No Goal Set" and "No Upcoming Vests Available", with the explanation behind an info button after the title and a larger action button. Upcoming Vests rows are bigger.
- Empty-state action buttons are 44px tall with rounder corners everywhere, and "Edit history" in Net Worth Over Time is "Edit History". The currency support note under that chart is gone.
- On phones, This Month's Budget leads with a Daily Spent Limit (what is left of your targets divided by the days remaining), an Ahead of Pace or On Pace pill beside it, and a bar with a tick for today, captioned with the amount spent and the day of the month. Desktop keeps the left-of-targets layout.

### Fixed
- On phones, the goal name in the Net Worth Forecaster chart was clipped by the top of the chart and ran under its line. It is now a 12px chip inside the chart beside the line, on the left when the goal is late in the forecast. On desktop the chart has room above it so the label on the line is no longer cut off, and it is 12px.
- Upcoming Vests on the Dashboard showed $0 for every vest when the stock price comes from live market data. It now uses the same price as the Compensation page.

## [0.26.3-beta] - 2026-10-15

### Changed
- On phones, Edit Compensation Package opens straight onto a card with the live total and the stock ticker and price, then Base & Cash, Equity and Benefits as tabs with one labelled card per topic and the Save button always pinned, instead of a title row above long single-column fields.
- On phones, the Compensation page leads with a donut and the total, with one-tap Current Year / Next 1 Year and Gross / After-Tax toggles that show both options. The after-tax figures, notice and Salary & Tax link appear only while After-Tax is on, the breakdown switches between Annualized and Monthly Cash Flow, the stock price and CAD conversion sit in one organised card, and the equity chart's legend is centred with the share valuation behind an info icon. "Unvested remaining" is now "Unvested Remaining" everywhere.
- On phones, Settings is a list of folds (Appearance, Market Data, Transactions, Backup, Sync, Reminders) with each section's state on the right: the theme name, No Key or Key Active, and Refunds Enabled or Disabled. Appearance opens first. Refunds & Payments is a switch with its explanation behind an info button, and the Google Drive setup text sits behind an info button after Google Client ID. Market Data, API key and client ID labels use Title Case on phone and desktop.
- On phones, the Add Transaction form puts Amount beside Date, then Category and Description, with a Details switch (Shared Bill, Split, Tags & Note) that opens one card at a time. Add Transaction stays pinned at the bottom, so the title row is gone. Shared bills use Paid for Others and Total Paid, with a tinted Owed to You line, and the Split card shows what is left to allocate.
- About this tool is now called Tool Overview. On phones, the first visit shows a dismissible "New Here? Read the Tool Overview" banner above the tool with an X to dismiss it, and after that a Tool Overview link sits below the results.
- On phones, the Tool Overview popup shows the how-to first, then an Inputs list where each input is a row that opens to its description, instead of one long block of name and description lines.
- On phones, the Planner page lists each section's tools as a divided list of names with icons and chevrons, without the one-line descriptions.

## [0.26.2-beta] - 2026-10-14

### Changed
- On phones, the Emergency Fund budget button reads "Use My Budget Average ($X/mo)" and only looks selected once your expenses match it, the Raise vs Inflation verdict has no trailing full stop, and Forecaster Plan rows show Projected and Lands in a tinted result line.
- On phones, the Inflation Adjuster year options read N yrs without a title, the Mortgage Monthly or Biweekly Accelerated selector sits under the inputs with the chart above Extra Payments, and the summary strips in Emergency Fund, Debt Payoff and Mortgage are centred.
- On phones, Compound Interest shows the future value with a contributed and growth bar, quick year options (10, 20, 30, 40), the inputs in a grid, and a chart with its legend centred inside the chart card.
- On phones, Savings Goal puts the Solve For options in a one-tap row, then only the inputs that apply, then the result.
- On phones, the chart legends in the Mortgage and Debt Payoff tools are centred inside their chart cards.
- On phones, Rent vs Buy shows the verdict with both costs side by side, quick horizon options (5, 10, 15, 25), the cumulative chart, and the inputs folded into Renting, Buying and Assumptions. The cost note now sits behind a "How This Is Calculated" info button.
- On phones, the Net Worth / FIRE Forecaster is split into Forecast, FIRE, Risk and Plan tabs, each under its own headline figure. Forecast keeps the essentials in view and folds Inflation, Step-Up, Spread and Events under More Assumptions. Risk shows the chance of reaching your FI number once, with the simulation note behind an info button.
- On phones, the quick year options in Compound Interest, Inflation Adjuster, Rent vs Buy and the Forecaster use the same segmented style as Emergency Fund, Debt Payoff puts its Avalanche or Snowball choice first, and the Forecaster Plan tab lists goals and life events in the same add-and-edit rows as the Mortgage extra payments.
- On phones, Salary & Tax shows income and province as one summary line, a Year, Month or Biweekly selector over the net pay, where the gross goes, then Total Tax, Marginal and Effective. Contributions, Tax Brackets (a Federal or Provincial ladder with the marginal breakdown) and RRSP Efficiency (the income in each saving slice) are folded below, and the tax year and calculation notes sit behind info buttons.
- On phones, the Planner charts (Compound Interest, Mortgage, Debt Payoff, Rent vs Buy and the Forecaster) use a slim value axis with compact amounts ($450k) and tighter card padding, so the plot fills the card instead of leaving an empty strip on the left. In Mortgage, the extra payments tip sits behind an info button next to the title.
- Compound Interest chart axes show compact amounts ($1.5M), and Mortgage and Currency Converter labels use Title Case (Time Saved, Max Home Price, Live or Stale rate).
- In the Forecaster charts, the "today" label is gone, legends read Conservative to Optimistic Band, Median Outcome and 10th-90th Percentile Range, and the shaded-band swatches are faded so they no longer match the line colour.
- On phones, the Rate & Return Converter has a From and To row with a swap button, then the rate and compounding (or the start value, end value and years), then the result.
- On phones, the Inflation Adjuster shows the converted amount first, then a purchasing power bar, then year presets (5, 10, 20, 30) with the amount, years and inflation fields.
- On phones, the Raise vs Inflation tool puts the three inputs first, then a single result card with the Real Raise, the Nominal Raise, the Real Change and the verdict, tinted to match.
- On phones, the Emergency Fund tool shows how much is funded first, as a percentage with a progress bar and a savings-of-target line, then the Target Fund and Gap to Close, then the months presets and inputs in a tidy grid.
- On phones, the Debt Payoff tool shows the debt-free time first with Total Interest and the saving against the other strategy, then the strategy toggle and extra payment. Debts are listed in the order they will be paid off, with the first one tagged Pay First, and each opens in place to edit or remove.
- On phones, the Mortgage tool shows the payment (or the maximum home price) first with its two supporting figures, then the inputs in a tidy grid with equal-height fields. Payment and Affordability, and Monthly and Biweekly, are full-width toggles, extra payments are compact cards with a clear Add button, and the affordability note moved behind an Estimation Details row.
- On phones, the Currency Converter shows the answer first ("100 USD is CAD 141.61") with the rate and a refresh button, then one card for the amount, the From and To currencies with a swap button, and the rate date. Rate Details is a single collapsed line showing when the rate was fetched, with the manual override inside.

## [0.26.1-beta] - 2026-10-13

### Changed
- On phones, Budgeting > Transactions has a rebuilt layout with a compact search and category selectors, and the gaps match the Overview and Insights tabs.
- On phones, Budgeting > Setup is split into Targets, Categories and Rules sections instead of a scaled-down desktop page.
- Categories can be added to any group and groups can be added from the Categories section. Removing a category or an empty group asks for confirmation first, and can be undone.
- Categorization and exclusion rules use full-width phone forms with 44px controls, and the empty Reallocation History card no longer shows as a blank box.
- The month and import controls sit closer to the Budgeting tabs on phones.
- On phones, the Setup Paradigm card has an info button that explains every budgeting paradigm, shows the Total Monthly Budget in its own band, and Add Group is a full-width accent button.
- On phones, the Triage Inbox is a compact list. Tap a row to review it, use Select to accept, ignore or set a category for several rows at once, and find Reject Card Payments and Discard All in the overflow menu.
- On phones, the message after an import is a compact card with To Review, Skipped and Excluded rows. Tap Skipped or Excluded for the list, and use the info button for charges that earlier imports had but the new file does not.

## [0.26.0-beta] - 2026-10-12

### Added
- Refunds & Payments applies incoming money against selected expense categories without counting it as income. It is enabled by default and can be turned off in Settings.
- Incoming imports can be reviewed as income or Refunds & Payments, with category credits reflected in spending totals and cash flow.
- User-defined exclusion rules match original bank descriptions by card or account, with a preview and optional direction and amount conditions.
- Matching imports can wait for review or be excluded automatically. Excluded entries retain their reasons and can return to review without creating duplicate charges.
- Overlapping transaction CSV imports remember the original charges and review decisions for each card or account. Repeated days skip already handled entries while preserving multiple identical purchases.
- Import summaries show skipped entries and changed days. Ignored charges can return to review, and possible duplicates show the existing entry with Same charge and Keep both actions.
- CIBC imports recognize the masked card automatically. Other CSVs let you choose a saved card or account. Import history travels with backups and sync; older transactions without source history remain reviewable.

### Fixed
- Import review cards keep Exclude similar transactions in the header and incoming treatment and category controls together, with a compact phone layout.
- The exclusion-rule popup matches the Add Transaction dialog style, with a solid background, consistent title-case labels, and shorter introductory text.
- The exclusion-rule popup uses a compact form with optional filters, match preview, and guidance. Pending application shows the count for all enabled rules when selected, and invalid fields show errors after interaction or save.
- Exclusion rule management uses a compact description/account row and bordered list. The popup closes from its header, and excluded-import history stays hidden when empty.

## [0.25.0-beta] - 2026-10-08

### Added
- Import CIBC credit card CSVs directly, with no column mapping. Purchases count as expenses, refunds reduce spending, and recognized card payments are held for review. Invalid rows report an error instead of importing a partial file.
- Accounts can hold native CAD or USD balances while category totals and net worth remain in CAD. USD account rows show the native balance and an approximate CAD value.
- Existing accounts without a saved currency have a one-time review. USD/CAD rates can be refreshed or entered manually.
- A Currencies control beside Customize opens exchange rates in a compact dialog, with a bottom sheet on phones. CAD balances use the dollar symbol; Account rows use compact separators, USD badges beside account names, and subtle conversion amounts beneath balances.

### Fixed
- Shared bill percentage buttons now use the transaction amount as the paid total when sharing is enabled, instead of calculating a zero share
- Shared bills label the editable amount as Your share and retain the paid total when a percentage or manual share is saved and reopened
- Shared bills now explain missing paid totals or people before saving, instead of silently dropping incomplete sharing details

### Note
- Saved net worth history remains in CAD as originally recorded. Earlier points may have treated foreign balances as CAD and are not recalculated.

## [0.24.0-beta] - 2026-10-03

Ledger on a phone now follows one written set of layout rules
(`docs/mobile-layout-rules.md`) instead of being the desktop layout stacked
into a single column.

### Added
- Planner tools on a phone put a Back button and the tool name in the top bar. Tap the name to switch to another tool. The breadcrumb header is gone
- About this tool on a phone appears once per tool as a dismissible notice above the tool. After that it is a centered button below the results. Which tools you have seen stays on the device and is not backed up or synced
- Phone sheets give screen reader and keyboard users a Close button. It stays out of sight until it takes focus, and then shows as a normal 44px control

### Changed
- On a phone, the top bar shows the page you are on and its main action: Add Transaction, Import holdings, New Analysis, Edit Package, or Customize. The action is a soft tinted circle. Page descriptions are shown on larger screens only
- Each page leads with its key number on a phone: net worth on the Dashboard, the period's net change on Budgeting, portfolio value on Investments, and total compensation on Compensation
- Holdings on a phone (any screen below 912px wide, tablet portrait included) are one compact row each. Tap a row for its currency, price, and cost. Each account shows its eight largest holdings first, with Show all for the rest
- Income, Expenses, and account lists on a phone show their first five entries with Show all, instead of scrolling inside the page
- Empty account groups on the phone Dashboard take one line instead of a full card
- Cash Flow on a phone groups the smaller income sources and spending categories into Other, so every label is readable
- Budgeting's month stepper on a phone has no card around it, and Import CSV is an icon-only button. Both keep 44px tap targets
- Budgeting and Investments tabs on a phone are underline tabs that fill the row. They scroll sideways with a fade at the edge only when the labels do not fit
- Phone sheets no longer show an X. Close them by swiping down, tapping outside, or pressing Escape. The title now scrolls away with the content, the drag handle stays pinned, and the top edge fades once the sheet has scrolled
- The tool switcher and search show a fade at the bottom instead of a scrollbar while more is below. Search drops the esc hint and keeps its field pinned while the results scroll
- The Settings sheet on a phone is organized: each section has a one-line description, every action is a 44px button, Enable reminders is a real button, the footer wraps instead of clipping, and the title is no longer shown above the sections
- The page scrollbar is hidden on phones. Scrolling works as before, and the desktop scrollbar and command palette are unchanged

### Fixed
- Switching pages now opens the new page at the top instead of at the previous page's scroll position
- The empty Portfolio and Compensation pages now include a button to add data
- Phone sheets now take keyboard focus when they open, and Tab stays inside the sheet. Before, focus stayed on the page behind it
- Closing About this tool on a phone returns focus to the button below the results instead of dropping it
- A phone sheet that was closed while scrolled no longer reopens with a stale fade at its top edge

## [0.23.1-beta] - 2026-09-27

### Changed
- Aurora Gradient cards now have a subtle emerald-to-sky-to-violet gradient
- Both Getting started actions on the Dashboard use the same button styling
- Salary and Tax now estimates annual take-home pay with standard employee tax credits and contributions, including QPP and QPIP in Quebec. Its tax, marginal-rate, and net-pay figures use the same annual calculation as automatic Compensation estimates
- RRSP room is no longer guessed from current salary. Enter your CRA deduction limit to compare available room and cap the modeled tax deduction; a contribution above that limit still counts as money paid out

### Fixed
- Salary and Tax now includes Ontario Health Premium and the Ontario and BC tax reductions, and uses the correct 2026 annual basic personal amount phaseouts for Manitoba and Yukon
- Corrected Prince Edward Island's upper tax bands and Newfoundland and Labrador's annual basic personal amount. RRSP tax savings and effective rates now follow the corrected annual calculation
- Portfolio reports now open the benchmark chart at the report period, with controls for 1Y, 3Y, 5Y, and Max. The chart no longer plots dates outside the account's history as zero returns, and the benchmark comparison uses the account's return rather than another benchmark's return
- The Compensation package editor can scroll to all of its content on shorter desktop windows instead of clipping it inside the dialog
- Refresh Price in Compensation now clears a manual stock price override and fetches a live price. If the live price is unavailable, the old override label disappears and the page explains what happened

## [0.23.0-beta] - 2026-08-31

The remediation of a full engineering audit, plus the portfolio redesign that
preceded it. The headline is a sync bug that could destroy data: pulling from a
device running an older version of Ledger deleted anything that version predated,
silently, on app open. That is fixed. Alongside it, the test suite now actually
runs before a deploy, every WCAG contrast failure in the light theme is closed,
and the app loads a fifth less code.

### Added
- Every chart that draws more than one series now names those series in text beneath it, with a colour swatch, instead of leaving them identifiable only by hovering for a tooltip
- The Salary and Tax result says which tax year it is for, and says plainly once that year has passed that the brackets and contribution limits have not been updated. The same warning now appears wherever else those rates are used: on Compensation's after-tax figure, and on the forecaster when it is applying an automatic tax rate
- Settings warns when automatic Drive sync has failed several times in a row. A single failure is still ignored, since a transient one is not worth interrupting you for, but a run of them meant sync had quietly stopped working and only a stale timestamp said so

### Changed
- Investments Portfolio tab: the three stat cards and the allocation donut with its mode toggle are replaced by a summary band (headline holdings value and all-time delta, strongest/weakest holding, largest weight, currency split, account value) and allocation bars for holding, account and currency
- The allocation breakdown by holding now shows the largest holdings and folds the remainder into a single "Other" entry. Seventeen holdings previously drew seventeen slivers and a seventeen-entry legend, which on a phone filled more than a screen before the first holding appeared
- An allocation bar is left out when it has only one segment, since a bar reading 100% says nothing. Strongest and weakest holding are left out when every holding has the same return, which is what happens before any live price arrives
- Holdings table drops from eight columns to six: Avg Cost and Book open from a disclosure on the ticker instead of sitting in their own columns
- On a tablet the holdings table is replaced by the same cards a phone shows. At that width the table needed more room than the sidebar left it, so two columns sat off the edge of the screen behind a scrollbar nothing advertised
- Every control now shows the same focus outline when you tab to it. Many different outlines were reachable in a single pass, and which one you got depended on whether the control was active, so two buttons in the same group could look different
- The app loads noticeably less code up front: 428 kB instead of 555 kB, after replacing the animation library with plain CSS. Sheets, page transitions and counting figures behave as before
- The moving background in the Aurora and Glass themes now holds still if your system is set to reduce motion

### Fixed
- Syncing from a device running an older version of Ledger no longer destroys data that version predates. A snapshot written by an older build simply has no record of newer features, and pulling it deleted them: an entire trade log could vanish on app open, with no prompt and no way back. A pull now only removes something when the device that wrote the snapshot actually knew about it
- A split transaction whose slices add up to more than the transaction itself can no longer be saved. It could be before, and every budget total then counted the larger figure: a 100 expense split 80 and 70 contributed 150 to the month
- A manual price override on a non-USD holding no longer gets converted a second time by the placeholder currency the market data service stamps on it. This had inflated the Portfolio tab's total by the USD exchange rate for every affected holding, disagreeing with the Dashboard rollup, which read the same override correctly
- A holding's share of the portfolio no longer displays with a plus sign, which made a weight of 15% read as a gain of 15%
- The allocation figures are labelled as Canadian dollars. The holdings table beneath them shows each holding in its own currency, so the same holding could appear as two different amounts one card apart with nothing to distinguish them
- Text in the light theme now meets the contrast standard everywhere. Active tabs, emphasised figures on Salary and Tax, the Mortgage and Forecaster controls and the keyboard shortcut hint were all slightly too faint against their own tinted backgrounds
- A market data request that never responds now gives up after ten seconds instead of leaving the price on a loading skeleton until you reload the page
- The Customize button on the Dashboard no longer runs into the edge of the screen on the narrowest phones
- The portfolio total no longer outgrows its column on a tablet, and now has room for an eight figure amount rather than only the value it happened to be designed against
- Screen readers can navigate the Investments and Compensation pages by heading again: both skipped a level, which breaks the outline those tools rely on

## [0.22.0-beta] - 2026-08-27

A sixth theme, Gilded Bloom, and the round of interface fixes that living
with it turned up.

### Added
- A sixth theme, Gilded Bloom: a warm light theme with softly raised cards, peacock green accents, and an art nouveau floral drawn in gold down the desktop sidebar. Pick it in Settings alongside the other five

### Changed
- The automatic sync setting now reads as one line, with its details collapsed behind "What automatic sync does". Nothing was removed, including the note that an automatic sync uploads the same snapshot a manual one does, any market data API key included
- Gilded Bloom sits second in the theme picker, beside the other light theme, rather than last
- In Gilded Bloom the settings dock at the foot of the sidebar is frosted, so Settings and the version number stay readable where the floral passes behind them
- The Customize button on the Dashboard is now the same size as the header buttons on Investments and Compensation. It was a size smaller
- Import holdings on the Investments Portfolio tab now sits in the page header, next to where New Analysis appears on the other tab, instead of in a row of its own below the tab strip

### Fixed
- The desktop sidebar no longer shows a stray horizontal scrollbar along its bottom edge. It affected every theme, on any display scaled so that a one pixel border renders as a fraction of a pixel
- The figures in the Allocation legend no longer sit flush against its scrollbar, which made the last digit of each amount read as cut off

## [0.21.0-beta] - 2026-08-25

Support for Chase credit card statements, and the groundwork refunds needed in
order to be recorded honestly.

### Added
- Chase credit card activity exports now import directly, instead of falling through to the manual column-mapping dialog. Merchant names arrive readable rather than HTML-escaped
- A credit card bill payment is now recognized for what it is. It arrives in triage badged "card payment, not income", is held back from Accept All so it can never be swept in as earnings, and can be cleared in one click with "Reject N card payments"
- Where you have no rule of your own for a merchant, Chase's own category is now used as a starting guess. Your own learned rules always win

### Changed
- A refund is now recorded as money returning to the category it left, rather than as income. Your income figure no longer counts refunds, and the category the money came back to reflects it
- A transaction amount may now be negative when it is an expense, so a refund can be entered or corrected by hand. Income still has to be greater than zero
- Amounts ending in exactly 50 cents now round the same way whether they are money in or money out. An expense of 21.50 and an income of 21.50 used to round to different dollar figures; now they match

### Fixed
- Amounts no longer render with two minus signs where a transaction is negative
- A month whose refunds outweigh its spending no longer shows a broken figure in the Monthly Summary, and an expense group in the same position is now left out of the Cash Flow chart instead of being drawn as a flow that cannot exist
- A budget progress bar can no longer render backwards when refunds exceed what was spent in a category, while the figure beside it still correctly reads as the negative amount it is

## [0.20.0-beta] - 2026-08-22

A desktop and tablet pass. The previous release fixed the phone experience; an audit of the
same app on a laptop, a desktop monitor and an iPad found a separate set of problems, and
this release closes them.

### Added
- Transactions and holdings can now be sorted by clicking a column heading, on date, description, category, amount, ticker, value or allocation. Sorting works from the keyboard and is announced to a screen reader
- The section you are looking at on Budgeting and Investments is now part of the address, so you can bookmark the Transactions tab or the Portfolio tab, share a link to it, and use the browser's Back button to undo a tab switch. A reload keeps you where you were instead of returning you to the first tab
- Investments now opens on Portfolio when you have imported holdings but written no analyses, instead of always opening on an empty Plan vs Actual
- The Compensation chart now lists each component beside it with its amount and share of the total, so you can read the breakdown without hovering
- The exchange-rate notice on the Investments page now has a Retry control, rather than only telling you rates were unavailable

### Changed
- The browser tab, your history and your bookmarks now show which page you are on. Every page used to be called just "Ledger"
- Tab strips are now real tabs: arrow keys move between them, and a screen reader says which one is selected
- Buttons and fields now share one visible outline when you reach them with the keyboard, in place of a mix of gold rings, grey browser outlines and, in several places, nothing at all
- Outlined buttons and inputs now have a border you can actually see. The old one sat at roughly a fifth of the contrast that guidance asks for, in every theme
- Scrollable panels, such as the expense list and the allocation breakdown, can now be scrolled with the keyboard
- Budget Setup on the Budgeting page now opens by default and has a clear control for collapsing it, instead of hiding the paradigm picker and monthly targets behind an unlabelled chevron
- Importing holdings now opens in a dialog, giving the top of the Investments page back to your actual portfolio
- Toggles now name what clicking them does and leave the on or off state to their appearance, in place of labels like "Convert to CAD: OFF" that never made clear whether they described the current state or the action
- The button that deletes every transaction now says "Delete all transactions" and sits away from the filters, rather than reading "Clear All" next to the category filter where it looked like it cleared the filters
- The Mortgage chart's vertical axis now reads in dollars, not bare digits like 600000, and both axes are labelled
- Empty cards on the Dashboard now show what to do next with a real button, rather than a sentence with a small inline link
- Planner tool cards now keep the same column count down the whole page

### Fixed
- Account names on the Dashboard were cut to one or two characters on an iPad held upright, showing as "M..", "E..." and "Q..". They now wrap instead
- Submitting the Add Transaction form with no amount did nothing at all, with no message. It now explains what is missing and takes you to the field
- The amount and description fields in Add Transaction, and the stock price fields on Compensation, had no label a screen reader could read
- Moving through the Dashboard with the keyboard passed through a dozen stops that showed nothing on screen, because the edit and delete buttons for each row were invisible until hovered. Those buttons were also permanently invisible on a touchscreen tablet, where hovering is not possible
- Settings and the opening disclaimer showed their heading and close button twice on a phone held sideways, on a short desktop window, and at high browser zoom
- The Compensation breakdown chart's labels ran off the side of the screen on a phone and were cut off on a tablet, leaving a coloured ring with nothing identifying its segments
- The Dashboard and the Investments page could report different totals for the same portfolio when live prices were unavailable. Both now fall back to what you paid, and a holding whose live price arrives in an unexpected currency is no longer converted as though it were in your own
- Charts had no description for screen readers and were announced as an unnamed application
- Table headings were not linked to their columns, so a screen reader could not tell you which column a figure belonged to

## [0.19.1-beta] - 2026-08-20

### Changed
- Mobile navigation: Search and Settings now live in a new top bar on phones, so the bottom bar can give all five sections (Dashboard, Budgeting, Investments, Planner, Compensation) full-width tabs instead of squeezing in a sixth. Compensation no longer gets cut off
- Every button, checkbox, and form field on a phone now meets a comfortable minimum touch size, in place of several controls (checkboxes, the currency selector, refresh and info buttons) that used to be too small to tap reliably
- Typing into any field on a phone no longer causes Safari to zoom the page in and stay zoomed
- Long account names on the Dashboard now wrap onto a second line on narrow phones instead of being cut off mid-word
- Charts take up noticeably less vertical space on phones, so a single chart no longer dominates the screen
- The Mortgage tool's payment chart now reveals its values with a tap on a touchscreen, not just a mouse hover
- The app's browser chrome (the colour behind the status bar on an installed app) now matches whichever theme is active, instead of always being black

### Fixed
- Settings was unreachable when a phone was held sideways: the sidebar used to take over in landscape and push Settings off the bottom of the screen with nothing to scroll. The app now keeps its phone layout through the height of the screen, not just its width
- The Compensation page's Gross/After-Tax toggle was clipped off the right edge of the screen on a phone and could not be tapped
- Bottom sheets (Settings, transaction entry, and others) could be partly hidden behind the on-screen keyboard on a tall form; they now stay above it
- The undo and update-available notifications could sit partly behind the bottom navigation bar on a phone with a home indicator; they now clear it
- The Mortgage chart's tooltip stopped responding to mouse hover on desktop after enabling tap support on phones; hover is restored on desktop while tap still works on phones

## [0.19.0-beta] - 2026-08-18

### Added
- Drive sync: an automatic sync option in Settings. Once you have synced manually at least once in a browser session, Ledger keeps that device current in the background, but only when there is nothing to decide, pulling or pushing on your behalf when the two sides agree cleanly. Anything that could overwrite work done on another device still stops and waits for you to resolve it in Settings, exactly as manual sync always has. Automatic sync uploads the same snapshot manual sync does, including any market data API key you have entered.
- Dashboard: the Getting started checklist can now be dismissed with its own close control, for anyone who wants it gone before finishing both steps

### Changed
- Budgeting: the transaction table now renders only the rows on screen on phones as well as on desktop, so a long list stays responsive while scrolling and searching on both. The card list used on phones no longer mounts every card up front
- Budgeting: a transaction row can now be opened with Enter or Space once focused on phones as well as on desktop, instead of needing a tap or a click
- The app now starts noticeably faster, especially on a phone or a slower connection, because the chart library no longer loads until a page that actually shows a chart is opened

### Fixed
- Recurring bills: a reminder for a bill due today now fires. Previously the due-date check missed bills due on the current day and only caught ones due in the next few days
- The demo data banner could keep showing after demo data was cleared, or fail to reappear after demo data was loaded again in the same session, in a few sequences involving undo. It now tracks the same underlying state every code path that can change it, including undo, so it always matches whether sample data is actually loaded
- Several labels dimmed with reduced opacity, such as helper text and secondary figures, fell below the WCAG AA contrast minimum in the default theme. They are now shown at full opacity

## [0.18.0-beta] - 2026-08-17

### Added
- Demo mode, in Settings under Backup: load a sample two months of transactions to see what a populated Ledger looks like before you enter your own. A banner marks it while it is on, the sample records never reach a backup file or a Drive sync, and clearing it removes only the sample records so anything you entered yourself survives. If you already have transactions, loading it asks first and offers an undo
- Recurring bills: optional reminders for bills falling due in the next few days. Turn them on in Settings, which is the only point Ledger asks your browser for notification permission
- Drive sync: a status chip in the sidebar reading up to date, stale, or never synced, so you no longer have to open Settings to learn whether this device is current
- A keyboard shortcuts list, opened with the ? key
- Dashboard: a Getting started checklist on a fresh install, pointing at your first account and first transaction, which disappears once both are done
- A Skip to content link, so keyboard and screen reader users can jump past the sidebar on every page

### Changed
- Budgeting: on desktop, the transaction table now renders only the rows on screen, so a list of several thousand transactions stays responsive while scrolling and searching, where it previously mounted every row at once. The card list used on phones is unchanged for now. Selecting across a large filtered list is faster in both
- Budgeting: on desktop, a transaction row can be opened with Enter or Space once focused, instead of needing a click. The card list used on phones still needs a tap
- The app's main code bundle is now less than half its former size, and the chart library, React and the router sit in their own files, so an update re-downloads less than it used to
- Geometric Light: the blue accent is slightly darker. The old shade fell below the WCAG AA contrast minimum against white wherever it was used for normal-size text, such as the active sidebar link

### Fixed
- Several small labels were too faint to meet the contrast minimum in the default theme: the version number in the sidebar, the help line under Drive sync, and the placeholder in the market data API key box
- Every page carried two top-level headings, one from the sidebar and one from the page itself, which made screen reader navigation ambiguous. The sidebar brand is no longer a heading

## [0.17.0-beta] - 2026-08-15

### Added
- Salary & Tax: an RRSP Efficiency block next to your deductions. It shows how much of your income sits in each marginal band, what sheltering each band would save, and the contribution that clears your top band
- Salary & Tax: an optional RRSP Room field. Leave it empty and the tool estimates your room at 18% of income up to the annual maximum, and says that it is an estimate. The room bar counts what is left after the contribution you have already entered, so a suggestion never quietly pushes you past your limit

### Changed
- Salary & Tax: the Deductions block now opens with a single bar of your whole gross income split into federal tax, provincial tax, CPP, EI and net pay, so the width of the bar means something. The four deduction bars below it are still shares of gross, and now say so
- Compensation: the line on the Equity Vesting Schedule now tracks the equity you have not vested yet, falling as each grant vests, instead of the total vested so far. Hovering any month gives you the figure, including months where nothing vests, and the chart now names each grant and states the share price the value depends on. The area under the line is filled in your current theme's colour
- Planner: the Raise vs Inflation verdict now sits in a banner coloured by the outcome instead of a loose line

### Fixed
- Compensation: a grant whose first tranche vested in the very first month of the chart did not show that vest, so the line started flat
- Charts: the hover tooltip could be drawn behind a chart's own labels, so the figure you were pointing at sat underneath the total in the middle of the Compensation donut
- Dashboard: the Net Worth Over Time chart wrote its side labels out in full, so a figure like $316,621 ran into the first date underneath it and the bottom corner read as one run-on line. The side labels are now shortened to $316k, matching every other chart
- Salary & Tax: the federal and provincial bracket ladders always showed a horizontal scrollbar, because the gaps between segments pushed the row past its own width. The segments now share the space and the ladders fit without scrolling at every income. Where a band is too narrow for its full figures, such as on a phone, its caption shortens to $0 to $54k rather than running into the band beside it
- Planner: the Rent vs Buy chart's explanatory caption was rendering outside the chart card

## [0.16.0-beta] - 2026-08-15

### Added
- Budgeting: a transaction can be split across several categories, so one shop that was part groceries and part household counts as both. Every budget figure, the 50/30/20 split and the category charts follow the slices
- Budgeting: transactions take tags and a note, and the search box matches both
- Budgeting: importing a CSV now marks rows that look like something already in your budget. Accept All takes only the rest, and there is a one-click way to reject the duplicates
- Undo now covers deleting an account, deleting a category or group, clearing all transactions, clearing the triage inbox, and accepting a whole import, not just deleting a transaction. The offer appears in one place at the bottom of the screen
- Dashboard: a Customize panel to switch widgets off and set their order, with up and down buttons so reordering works on a phone
- Net worth: an Edit history window on the trend chart to add, correct or delete dated figures, so you can backfill months from before you installed the app. A point is also recorded each day you open it, so the trend is sampled by time rather than by how often you happen to edit an account
- Investments: a Trades tab. Record your buys and sells to see realized gains for the year, your adjusted cost base per holding, and a warning when the trades you entered disagree with an imported holding
- If you use Drive sync, update Ledger on every device before recording trades. A device still on an older version does not know about the Trades tab, and a sync from it will remove your trade log from the other devices
- Investments: prices and exchange rates now say how old they are and offer a refresh where the figure is shown, instead of only saying "cache" or "stale"

### Fixed
- A widget that hit unexpected data used to blank the whole page. Now it fails inside its own card with a Try again button and the rest of the page keeps working

## [0.15.0-beta] - 2026-08-14

### Added
- Budgeting: a search box on the transaction list, matching on description or category name
- Budgeting: tick boxes on the transaction list to select many transactions at once, then set a category on all of them or delete them together
- Budgeting: deleting a transaction now offers an Undo, for single rows and for a bulk delete
- Budgeting: the Subscriptions widget lists what is due in the next 30 days with a running total, and a charge that is not really a subscription can be ignored and restored later

### Fixed
- Backups and Drive sync were silently leaving out your uploaded PortfolioAnalyst report, so the Account Value card, benchmark comparison and contributors were lost on a restore or on a second device. The report is now included, and the app derives its backup list from a single registry of stores so a future store cannot go missing the same way
- A brand new install started with four made-up accounts (a chequing account, a retirement account, a mortgage and a personal loan), so the dashboard, net worth and forecaster all showed money that was not yours. A new install now starts empty and invites you to add your first account. If those four accounts are still sitting untouched in an existing install they are removed on upgrade, and your stored net worth history is cleared along with them, since every past snapshot was computed with that fake money included and would otherwise show a large phantom swing on the trend chart. Anything you renamed, revalued or added is kept; if you had been tracking real balances alongside the demo accounts, your net worth trend will start over after the upgrade
- Editing an account or a transaction reset its form through an extra render pass, which could briefly show stale values. The forms are now built fresh each time the pop-up opens

### Changed
- The app is split into one bundle per page instead of a single bundle: the largest chunk that loads up front dropped from 1,229 kB (350 kB gzipped) to 463 kB (143 kB gzipped), so opening it downloads noticeably less before the dashboard appears. The other pages load when you first visit them

## [0.14.0-beta] - 2026-08-13

### Added
- Google Drive sync. Push and pull your whole dataset as timestamped JSON snapshots in a `Ledger` folder in your own Drive, using an OAuth client ID you supply in Settings. Snapshots carry a revision number, and the app warns before a push overwrites a newer snapshot from another device or a pull discards unpushed local edits. Retention keeps the most recent 100 snapshots and moves older ones to the Drive bin.
- Settings shows the name of this device, which you can edit so sync warnings name the right machine, and a Disconnect control that forgets the Drive link and sync history without touching any data.

### Changed
- Backup envelope is now version 2, carrying device and revision metadata. Version 1 backup files still import.
- Restoring a backup now validates the whole file before writing anything, so a corrupt file cannot leave data half-restored, and it writes only keys the app recognises.

## [0.13.0-beta] - 2026-08-12

### Added
- Investments: the Portfolio tab now shows an Account Value card with the true account value from an uploaded PortfolioAnalyst report, including the cash balance and net of any margin loan. It lists the cash sleeve (negative when you are drawn on margin) and the report period, so a margin account no longer looks like it holds only the sum of its positions. A report in a currency other than Canadian dollars is labelled with that currency rather than converted

### Fixed
- Budgeting: the period picker, month selector, Import CSV and Add Transaction controls in the page header were three different heights; they now line up on a single row. On phones the month arrows keep their full-size tap targets
- Investments: the Benchmark Comparison chart labelled its horizontal axis with raw values like "202601". It now reads "Jan 2026", on both the axis and the hover tooltip
- Investments: the Benchmark Comparison chart plotted its months in whatever order the report listed them, so the line could run backwards through time. Months are now ordered oldest-first, which also corrects the compounded growth figures
- Compensation: the ESPP lock-in price, company stock price, and grant price are labelled USD, so it is clear which currency they are entered in
- Dashboard: the Net Worth widget's month-over-month percentage printed its full unrounded value (for example -0.15652843963654473%). It now shows two decimals
- Desktop: the divider between the sidebar and the page used to begin abruptly at the top edge with nothing meeting it, while its lower end was anchored by the settings bar. It now fades in, so it no longer looks unfinished
- Pop-ups taller than the window were cut off at the top with no way to scroll back up to them. They now scroll to reveal their full height, headers included. This affected What's New most, but applied to every desktop pop-up
- Investments: allocation donuts reused the same six colours, so a seventh holding was drawn in the same colour as the first. Every slice now gets a distinct shade
- Investments: the report's allocation donuts now list slices largest-first, matching the Portfolio tab

### Changed
- What's New now lists only the releases in the current version series; earlier ones are tucked behind an "Older versions" section, so the window opens short instead of listing every release back to 0.1.0
- Investments: the Portfolio tab's "Value Now" total is now "Holdings Value", since it counts only your positions and never included cash or a margin loan
- Investments: the allocation donut on the Portfolio tab is noticeably larger

## [0.12.1-beta] - 2026-07-23

### Fixed
- Mobile: content at the bottom of long pages is no longer hidden behind the bottom navigation bar. Scrolling to the end now clears the nav, so buttons and captions at the foot of a page are reachable
- Mobile: pop-ups and sheets (Settings, Add Account, Add Transaction, the CSV importer, and the rest) now fill the screen width instead of appearing as a narrow panel pinned to one side, their sections are spaced correctly, and each shows a single close button instead of two
- Mobile: the Salary and Tax bracket bars show every bracket's full dollar range and rate instead of clipping the label

### Changed
- Mobile: pages now use the full screen width. Doubled-up page margins were removed, so content is roughly 40px wider on a phone and text wraps less
- Mobile: the bottom navigation tabs are evenly spaced and their labels stay on one line instead of crowding on narrow phones
- Mobile: controls for editing accounts, stepping through months, and similar actions now have finger-friendly tap targets
- Mobile: the Budgeting header is simpler on phones, with a single month control and a compact toolbar, so it takes up less of the screen
- Mobile: the Net-Worth Forecaster's Monte Carlo cards stack in one clean column on phones instead of sitting unevenly
- Dashboard: rearranging widgets by dragging is now a desktop-only feature, since it never worked by touch

## [0.12.0-beta] - 2026-07-22

### Added
- Budgeting: a new Savings Rate widget on the Overview tab, with a rate gauge and toggles for a net-savings trend and a saved-versus-spent split. It follows the timeframe you pick above and shows amounts on hover

### Changed
- Budgeting: the Income Flow chart is now Cash Flow, a colored diagram that traces each income source into your spending groups and, when you spend less than you earn, into a Savings outlet so the money you kept is visible
- Budgeting: the Income widget now breaks down by source (Salary, RSU, and so on) and the Expenses widget groups spending by category group (Housing, Food, and so on) instead of individual categories
- Budgeting: annual budget rows no longer show the "set aside by now" line; they show what you have spent and what is left for the year
- Tooling: eslint now ignores the .claude tooling directory, so lint reports only real application issues

## [0.11.0-beta] - 2026-07-21

### Added
- Budgeting: categories can be budgeted annually instead of monthly; a /mo /yr toggle on the Setup tab lets you pick the cadence. Annual categories like vacations are tracked against calendar-year spend in their own Annual budgets section, with a set-aside pace line showing what you should have put aside by now, while still contributing one twelfth to each month's budget total
- Investments: the Portfolio tab now has an allocation donut above your holdings, with a toggle to group by holding, by account, or by currency
- Investments: holdings table columns are now sortable, each account shows a value and P/L subtotal, and each row has an allocation micro-bar

### Changed
- Investments: portfolio holdings now support every currency your broker reports, not just USD and CAD. Each currency is converted to CAD with its own live rate; a live quote in a different currency than your cost basis is converted correctly; and holdings whose currency has no available rate are shown in their own currency and clearly excluded from the CAD totals instead of being silently miscounted. You can set a holding's currency inline if an import got it wrong
- Investments: the PortfolioAnalyst report was reworked around a summary hero, allocation donuts, and a top contributors and detractors chart, and it is collapsed by default so it no longer stretches the page

### Fixed
- Compensation: converted stock prices now display to three decimals instead of overflowing their input box. Full precision is kept for the underlying calculations
- Investments: portfolio imports (both broker CSVs and PortfolioAnalyst reports) no longer store every foreign-currency position as Canadian dollars. A one-time notice flags holdings imported before this release so you can re-check their currency

## [0.10.0-beta] - 2026-07-19

### Added
- Budgeting: shared bills. Mark an expense as shared, set your share (50/33/25% quick buttons), and name who owes you; only your share counts in the budget. An Owed to Me widget tracks per-person balances with one-click settle-up, and income can be marked as a reimbursement so paybacks never inflate your income
- Budgeting: period picker on the Budgeting page (This month, Last month, Last 3/6/12 months, Year to date); Overview and Insights widgets aggregate over the chosen range, and the spending calendar becomes a month-by-month grid for multi-month periods
- Budgeting: Budget vs. Actual shows your total monthly budget with its own progress bar, plus an Unbudgeted spending row so money outside targeted categories is visible; the Setup tab shows the same total
- Budgeting: Clear All button on the triage inbox with a confirm dialog
- Investments: the Portfolio tab now recognizes IBKR PortfolioAnalyst report CSVs: key statistics, benchmark comparison chart and table, allocations by asset class/sector/region, performance by symbol, dividends and projected income, and fees, with an optional one-click holdings update from the report's open positions

### Changed
- Compensation: the USD to CAD conversion now shows where its rate came from (live, cached with date, or manual) and offers an inline manual-rate field; the app falls back to the most recent known rate instead of silently converting at 1.0 when the rate service is unreachable

### Fixed
- Investments: uploading an Activity Statement in the Options tab can no longer hang on "Parsing CSV(s)"; the upload reports how many rows were added or what went wrong
- Budgeting: Income Flow chart no longer clips category labels on the left side
- Clicking buttons and inputs no longer draws the browser's default white focus box in dark themes; keyboard navigation shows a themed accent ring instead
- Luxury theme: Save buttons and RSU preset buttons now use black text on the gold accent for readability

## [0.9.0-beta] - 2026-07-18

### Added
- Net-Worth / FIRE Forecaster chart now has a legend naming each series (Projected line, Conservative to Optimistic band, Contributed vs Growth areas, Actual history)
- Compensation: switching to Monthly Cash Flow View with After-Tax on shows a note explaining the bars stay gross (monthly withholding varies too much to estimate honestly)

### Changed
- Confirmation popups are now themed in-app dialogs instead of browser popups: replacing the Salary & Tax income from Compensation, clearing all transactions in Budgeting, and clearing wheel tracker data in Investments
- Forecaster: the comp event tax controls (after-tax toggle, marginal or manual rate) moved behind a small gear popover next to the Comp Events and Debt Drag toggles
- Budgeting: every paradigm description now fits on one line, and the 50/30/20 status bar spans the full width of its banner

### Fixed
- Forecaster: in Real (Today's Dollars) mode the conservative and optimistic scenario bands are now inflation-deflated like the projected line, so the projection no longer dips below its own conservative band

## [0.8.0-beta] - 2026-07-17

### Added
- Budget paradigms are now functional: pick Ledger Custom, Zero-Based, Target-Based, or the 50/30/20 Rule in Budget Setup and the Budgeting page enforces it with status banners (unassigned dollars, buffer health, or needs/wants/savings ratios)
- Zero-Based overspending shows a Cover button that moves budget from another category via a new reallocation dialog; the setup tab lists the month's reallocations with delete
- 50/30/20 mode adds Need / Want / Savings chips on expense groups to classify spending
- Compensation: a Gross / After-Tax toggle on the Total Compensation widget estimates take-home pay using the Salary & Tax calculator's math and your saved province, with net monthly and biweekly figures
- A "Full breakdown in Salary & Tax" link pre-fills the calculator with your total compensation (asking before replacing a different saved income)
- Net-Worth / FIRE Forecaster: goals and life events show their projected calendar date inside the list cards
- Forecaster comp events can be taxed: an After-Tax toggle applies your marginal rate (auto-detected with province, or a manual rate); RSU/ESPP treated as employment income

### Fixed
- PWA app icon now shows the new logo on fresh installs (icon files renamed so installs stop serving the cached old lightning icon; existing installs may need a reinstall)
- Forecaster: stacked Contributions vs Growth view now respects Real (Today's Dollars) mode; the "today" label stays anchored to the today line; y-axis uses compact labels ($1.5M instead of $1,500,000)
- Forecaster: Monte Carlo footnote sits inside its card instead of overflowing it

## [0.7.0-beta] - 2026-07-17

### Added
- New logo: an L that doubles as chart axes with a rising trend line. In the sidebar next to the wordmark (drawn in the active theme's accent), as the favicon, and in the app icons (gold on black)
- Budgeting: a Today button jumps back to the current month after paging away

### Changed
- Page headers now match the sidebar labels: Dashboard, Budgeting, Compensation (previously "Master Dashboard", "Budgeting Module", "Total Compensation Calculator")
- Planner and Compensation swapped nav icons: the calculator now marks the calculators page, Compensation gets a briefcase
- The search shortcut hint shows Ctrl K on Windows and ⌘K on Mac; the sidebar version number explains it opens What's New

### Fixed
- Negative net worth reads -$210,000.00 instead of $-210,000.00
- Budgeting month arrows no longer stick on the same month in timezones ahead of UTC

## [0.6.1-beta] - 2026-07-16

### Changed
- Settings popup reorganized into cards: Appearance, Market data (key status badge, setup guide collapsed behind "How to get a free key"), Backup, and a compact About footer
- Theme picker tiles now preview the app in each theme (header bar and sparkline in the theme's own colors)
- Sidebar: new Search button reveals the Ctrl/Cmd+K command palette, active page gets an accent bar, settings dock flattened to one row, "Command Center" tagline removed

## [0.6.0-beta] - 2026-07-16

### Added
- Options tab in Investments: wheel strategy tracker ported from the standalone tool: upload IBKR activity statement CSVs to see per-ticker premium collected, true breakeven, and live-price Net P/L (PDF export not carried over)
- Currency converter now supports USD, CAD, EUR, GBP, AUD, JPY, KRW, INR and BDT with From/To selectors (BDT via a fallback rate source, latest rates only)
- Settings hub: theme picker, market data key, backup and about consolidated into one sheet (gear in the sidebar dock / a new Settings tab on mobile)

### Changed
- Theme picker shows preview swatch cards for all themes
- Mortgage payment-frequency toggle moved beside the Payment/Affordability toggle
- 0.4.0 and 0.5.0 releases relabeled as betas

### Fixed
- Edit Compensation modal pre-fills the live stock price instead of a stale manual value
- Debt payoff rows no longer leave empty columns for credit cards, lines of credit and payment-mode loans
- Mobile: pages scroll fully clear of the bottom tab bar
- Planner date picker placeholder capitalization ("Select Date")

## [0.5.0-beta] - 2026-07-13

### Added
- Live stock prices via your own Alpha Vantage API key (free, 25 lookups a day); a new Market Data settings modal in the sidebar dock and mobile settings row lets you add and manage it. Quotes refresh automatically at most once every 4 hours (and when the app comes back online); the refresh button still updates on demand.

### Changed
- The "Estimates Only · Not Financial Advice" disclaimer link moved from the desktop sidebar into the What's New modal; mobile keeps its button.
- What's New modal now has a blurred backdrop.
- Em dashes removed app-wide, with wording adjusted case by case.

### Fixed
- Currency conversion rates work again: the Frankfurter API moved to api.frankfurter.dev/v1, and the old domain was silently breaking requests from the browser.

### Removed
- The Yahoo Finance provider, which never worked from a static site due to browser CORS restrictions.

## [0.4.0-beta] - 2026-07-11

### Added
- Debt Payoff: pick a debt type: Credit Card and Line of Credit minimums are calculated for you (3% of balance / interest-only, updated as the balance falls); Loans take either your known payment or your amortization term.
- Mortgage: Biweekly (Accelerated) payment toggle: see the per-paycheque amount, how many years sooner you're done, and the interest saved.
- "Check for Updates" button in What's New, plus an update check every time the app launches, so installed-app updates no longer depend on visiting the website.
- First-launch disclaimer and a persistent "Estimates Only · Not Financial Advice" link.

### Changed
- What's New shows only the latest version expanded; older releases are collapsible. The panel and tool info popovers are wider.
- One capitalization rule everywhere: labels, buttons, and headings are Title Case.
- Plan vs Actual: the card's add button follows the tab: "+ Position" on Plan, "+ Trade" on Actual.
- Mobile: theme selector and the version link sit on their own rows.

### Fixed
- Tool list and info popovers are opaque and readable in Glassmorphism and Aurora themes.
- New Analysis dialog no longer shakes while typing a ticker or exchange.
- Mobile pages no longer get cut off behind the bottom navigation bar.

## [0.3.0-beta] - 2026-07-10

### Added
- "New version available" toast: the app now tells you when an update is ready instead of silently serving an old build.
- Total Return in dollars (alongside %) in the investing Plan/Actual summary.
- Initial Investment vs Extra Investment split in the Actual tab, derived from your recorded trade dates.
- Income days now appear on the spending calendar as a green marker (they were previously invisible there).
- Separate income and expense categories, driven by your Budget Setup groups.
- What's New panel (this one!) and in-app version display.
- Two new Planner utilities: **Inflation Adjuster** (what today's dollars cost later, e.g. what your savings goal will really be worth when you reach it) and **Rate & Return Converter** (APR ⇄ APY across compounding frequencies, plus CAGR from any start/end value).

### Changed
- Planned Budget is now edited directly in the summary strip; the standalone input is gone.
- Numeric fields can be empty while you type, with no leading-zero (0100) glitch, and spinner arrows are removed.
- Income Flow chart sits beside Budget Progress on desktop instead of taking a full row.

### Fixed
- Dropdown menus are opaque and readable in the Aurora theme; the mobile bottom navigation is opaque in the Glass theme.
- Chart hover tooltips are readable in dark themes.
- The New Analysis dialog no longer shakes while typing.
- Budgeting page no longer scrolls sideways on mobile.

## [0.2.0-beta] - 2026-07-06

### Added
- Plan vs Actual tracking for investment analyses: planned budget with per-ticker allocation %, trade lots, swap what-if simulator.
- Upcoming Vests dashboard widget; spending calendar color legend.

### Changed
- Position cards collapse by default; new-analysis flow mirrors the plan table.
- Planner: Income & Tax moved above Debt & Housing; clearer info popups; Title Case labels app-wide.

### Fixed
- Net worth trend Y-axis starts at the data range instead of zero.
- Forecaster source labels; expenses widget $0 layout.

## [0.1.0-beta] - 2026-07-01

### Added
- Initial release: Dashboard, Budgeting (transactions, categories, insights), Investments, Planner tools, Compensation tracking.
- Five visual themes, PWA install/offline support, CSV import, local-first storage with backup/restore.
