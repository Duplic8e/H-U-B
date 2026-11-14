import React, { Suspense, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { PageHeader, TopBarAction } from '../components/ui/PageHeader';
import { BentoGrid } from '../components/dashboard/BentoGrid';
import { NetWorthWidget } from '../components/dashboard/widgets/NetWorthWidget';
import { IncomeWidget } from '../components/budget/IncomeWidget';
import { ExpenseWidget } from '../components/budget/ExpenseWidget';
import { MonthlySummaryWidget } from '../components/budget/MonthlySummaryWidget';
import { AccountCategoryWidget } from '../components/dashboard/AccountCategoryWidget';
import { PortfolioRollupWidget } from '../components/dashboard/widgets/PortfolioRollupWidget';
import { BudgetHealthWidget } from '../components/dashboard/widgets/BudgetHealthWidget';
import { PlannerGoalWidget } from '../components/dashboard/widgets/PlannerGoalWidget';
import { UpcomingVestsWidget } from '../components/dashboard/widgets/UpcomingVestsWidget';
import { useDashboardLayoutStore } from '../store/useDashboardLayoutStore';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { FirstRunChecklist } from '../components/dashboard/FirstRunChecklist';
import { AccountCurrencyReview } from '../components/accounts/AccountCurrencyReview';
import { useAccountsStore } from '../store/useAccountsStore';
import { useBudgetStore } from '../store/useBudgetStore';
import { DashboardMobile } from '../components/dashboard/DashboardMobile';
import { NeedsAttentionCard } from '../components/budget/NeedsAttentionCard';
import { DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_LABELS, WIDGET_SPAN } from './dashboardWidgets';

// Re-exported so callers (and tests) can import ids/labels from this module too.
export { DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_LABELS };

// NetWorthTrendWidget pulls in recharts, which is split into its own build
// chunk (see vite.config.ts). The chart chunk itself now loads eagerly for
// every visit regardless of this lazy boundary, since this bundler version
// cannot express reachability-correct splitting for it and it stays in the
// PWA precache rather than being fetched on demand. Lazy-loading the widget
// still defers parsing and executing the chart code until it actually
// mounts, which is a real render-time benefit independent of network timing.
const NetWorthTrendWidget = React.lazy(() =>
  import('../components/dashboard/widgets/NetWorthTrendWidget').then((m) => ({ default: m.NetWorthTrendWidget }))
);

// The rate editor and its NumberInput are only needed when USD accounts exist.
// Keep that editor out of the initial Dashboard graph while the review notice
// and global rate coordinator remain available immediately.
const AccountFxControls = React.lazy(() =>
  import('../components/accounts/AccountFxControls').then((m) => ({ default: m.AccountFxControls }))
);
const CustomizeDashboard = React.lazy(() =>
  import('../components/dashboard/CustomizeDashboard').then((m) => ({ default: m.CustomizeDashboard }))
);

/** Widgets the phone Dashboard shows through DashboardMobile's own three cards instead of one card each. */
const PHONE_CARD_WIDGETS = ['trend', 'income', 'expense', 'monthly-summary', 'bank', 'investment-accounts', 'other', 'receivable', 'debt'];

export const Dashboard: React.FC = () => {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [dragId, setDragId] = useState<string | null>(null);
  const moveWidget = useDashboardLayoutStore((s) => s.moveWidget);
  const storedOrder = useDashboardLayoutStore((s) => s.order);
  const setOrder = useDashboardLayoutStore((s) => s.setOrder);
  const hidden = useDashboardLayoutStore((s) => s.hidden);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeOpenedBefore, setCustomizeOpenedBefore] = useState(false);
  const openCustomize = () => { setCustomizeOpenedBefore(true); setCustomizeOpen(true); };
  const isDesktop = useIsDesktop();
  const accountCount = useAccountsStore((s) => s.accounts.length);
  const hasUsdAccount = useAccountsStore((s) => s.accounts.some((account) => account.currency === 'USD'));
  const transactionCount = useBudgetStore((s) => Object.keys(s.transactions).length);

  // id -> element pairing stays render-scoped: most widgets depend on `currentMonth`
  // (recomputed each render), so the elements themselves cannot be hoisted alongside the ids.
  const DASHBOARD_WIDGETS: { id: string; element: React.ReactNode }[] = [
    {
      id: 'net-worth',
      element: (
        <Suspense fallback={<div className="min-h-[292px]" aria-hidden="true" />}>
          <NetWorthTrendWidget />
        </Suspense>
      ),
    },
    { id: 'trend', element: <NetWorthWidget /> },
    { id: 'monthly-summary', element: <MonthlySummaryWidget range={{ from: currentMonth, to: currentMonth }} /> },
    { id: 'bank', element: <AccountCategoryWidget title="Bank Accounts" type="bank" /> },
    { id: 'investment-accounts', element: <AccountCategoryWidget title="Investment Accounts" type="investment" /> },
    { id: 'income', element: <IncomeWidget range={{ from: currentMonth, to: currentMonth }} /> },
    { id: 'expense', element: <ExpenseWidget range={{ from: currentMonth, to: currentMonth }} /> },
    { id: 'receivable', element: <AccountCategoryWidget title="Receivables" type="receivable" /> },
    { id: 'other', element: <AccountCategoryWidget title="Others" type="other" /> },
    { id: 'debt', element: <AccountCategoryWidget title="Debts & Liabilities" type="debt" /> },
    { id: 'portfolio', element: <PortfolioRollupWidget /> },
    { id: 'budget-health', element: <BudgetHealthWidget /> },
    { id: 'top-goal', element: <PlannerGoalWidget /> },
    { id: 'upcoming-vests', element: <UpcomingVestsWidget /> },
  ];

  const defaultIds = DASHBOARD_WIDGET_IDS;
  const orderedIds = [
    ...storedOrder.filter((id) => defaultIds.includes(id)),
    ...defaultIds.filter((id) => !storedOrder.includes(id)),
  ];

  // Null-safe resolution: if an id in orderedIds has no matching widget (e.g. a
  // future id mismatch between DASHBOARD_WIDGET_IDS and DASHBOARD_WIDGETS), it is
  // skipped instead of crashing the render with a non-null assertion.
  const resolvedWidgets = orderedIds
    .map((id) => {
      const widget = DASHBOARD_WIDGETS.find((x) => x.id === id);
      return widget ? { id, element: widget.element } : null;
    })
    .filter((w): w is { id: string; element: React.ReactNode } => w !== null);

  // Hidden widgets stay out of the render but orderedIds (all ids, hidden
  // included) still goes to the Customize panel and to moveBy, so a hidden
  // widget's position survives instead of being dropped from saved layout.
  const visibleWidgets = resolvedWidgets.filter((w) => !hidden.includes(w.id));

  return (
    <div className="min-h-full w-full">
      <PageHeader
        title="Dashboard"
        subtitle="All your accounts, balances, and trends in one place."
        className="mb-8"
        actions={
          /* Sized to the page-header tier, matching New Analysis on
              Investments and Add Compensation on Compensation: px-4 and 14px,
              not px-3 and 13px. It stays an outline button rather than a filled
              accent one on purpose. Those two create a record; this one only
              changes a layout preference, and promoting it to the same weight
              would put two competing primaries in the header language.
              `control-border` is also deliberate over the more common
              `border-border`: see the note above .control-border in
              src/index.css. A control's own edge has to reach 3:1, and
              e2e/desktop-guards.spec.ts enforces exactly that on this button. */
          <div className="flex flex-wrap items-center justify-end gap-2">
          {hasUsdAccount && <Suspense fallback={null}><AccountFxControls /></Suspense>}
          <button
            type="button"
            onClick={openCustomize}
            /* shrink-0: at 320px the header's flex row squeezed this to a 76px
               box for an 81px label, so it rendered against the screen edge with
               its right padding eaten. The heading beside it wraps instead. */
            className="shrink-0 whitespace-nowrap px-4 py-2 rounded-md text-[14px] font-medium border control-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
          >
            Customize
          </button>
          </div>
        }
        // Quiet, not primary: Customize changes a layout preference, it does
        // not create anything, which is why the desktop button is an outline.
        phoneAction={<div className="flex items-center">{hasUsdAccount && <Suspense fallback={null}><AccountFxControls phone /></Suspense>}<TopBarAction icon={SlidersHorizontal} label="Customize" tone="quiet" onClick={openCustomize} /></div>}
      />
      <div className="mb-4 empty:hidden"><NeedsAttentionCard compact /></div>

      <AccountCurrencyReview />
      <FirstRunChecklist accountCount={accountCount} transactionCount={transactionCount} />

      {!isDesktop && (
        // The figure, the month and the account groups come first as three cards; every other visible
        // widget follows in saved order. Customize still controls what the three cards include.
        <DashboardMobile
          hidden={hidden}
          rest={
            <div className="flex flex-col gap-6">
              {visibleWidgets
                .filter((w) => !PHONE_CARD_WIDGETS.includes(w.id))
                .map((w) => <div key={w.id} data-widget-id={w.id}>{w.element}</div>)}
            </div>
          }
        />
      )}
      {isDesktop && <BentoGrid>
        {visibleWidgets.map(({ id, element }) => {
          return (
            <div
              key={id}
              data-widget-id={id}
              draggable={isDesktop}
              onDragStart={isDesktop ? () => setDragId(id) : undefined}
              onDragOver={isDesktop ? (e) => e.preventDefault() : undefined}
              onDrop={isDesktop ? () => {
                if (dragId && dragId !== id) {
                  if (storedOrder.length === 0) setOrder(orderedIds); // materialize default before first move
                  moveWidget(dragId, id);
                }
                setDragId(null);
              } : undefined}
              onDragEnd={isDesktop ? () => setDragId(null) : undefined}
              className={`h-full ${WIDGET_SPAN[id] ?? ''} ${isDesktop ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === id ? 'opacity-50' : ''}`}
            >
              {element}
            </div>
          );
        })}
      </BentoGrid>}

      {customizeOpenedBefore && <Suspense fallback={null}>
        <CustomizeDashboard open={customizeOpen} onClose={() => setCustomizeOpen(false)} orderedIds={orderedIds} />
      </Suspense>}
    </div>
  );
};
