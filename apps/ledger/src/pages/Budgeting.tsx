import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChartNoAxesCombined, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { monthKeyOf, rangeOf, shiftMonthKey, type Period } from '../utils/budget/period';
import { Tabs, type TabItem } from '../components/ui/Tabs';
import { TabPanel } from '../components/ui/TabPanel';
import { ThemedSelect } from '../components/ui/ThemedSelect';
import { IncomeWidget } from '../components/budget/IncomeWidget';
import { ExpenseWidget } from '../components/budget/ExpenseWidget';
import { MonthlySummaryWidget } from '../components/budget/MonthlySummaryWidget';
import { TransactionModal } from '../components/budget/TransactionModal';
import { CSVUploader } from '../components/budget/CSVUploader';
import { TriageInboxWidget } from '../components/budget/TriageInboxWidget';
import { CashPlanWidget } from '../components/budget/CashPlanWidget';
import { NeedsAttentionCard } from '../components/budget/NeedsAttentionCard';
import { BillsThisMonthCard } from '../components/budget/BillsThisMonthCard';
import { SavingsRateMobile } from '../components/budget/SavingsRateMobile';
import { ImportSummary } from '../components/budget/ImportSummary';
import { ExcludedImportsWidget } from '../components/budget/ExcludedImportsWidget';
import { CategorizationRulesWidget } from '../components/budget/CategorizationRulesWidget';
import { ExclusionRulesWidget } from '../components/budget/ExclusionRulesWidget';
import { TransactionListWidget } from '../components/budget/TransactionListWidget';
import { CategoryManagerWidget } from '../components/budget/CategoryManagerWidget';
import { SubscriptionsWidget } from '../components/budget/SubscriptionsWidget';
import { AnomalyAlertsWidget } from '../components/budget/AnomalyAlertsWidget';
import { CashFlowWidget } from '../components/budget/CashFlowWidget';
import { SpendingHeatmapWidget } from '../components/budget/SpendingHeatmapWidget';
import { CategoryTrendsWidget } from '../components/budget/CategoryTrendsWidget';
import { BudgetProgressWidget } from '../components/budget/BudgetProgressWidget';
import { ParadigmBanner } from '../components/budget/ParadigmBanner';
import { ReallocationHistory } from '../components/budget/ReallocationHistory';
import { OwedToMeWidget } from '../components/budget/OwedToMeWidget';
import { SavingsRateWidget } from '../components/budget/SavingsRateWidget';
import { useBudgetStore } from '../store/useBudgetStore';
import { PageHeader, TopBarAction } from '../components/ui/PageHeader';
import { useIsDesktop, useMediaQuery } from '../hooks/useMediaQuery';
import { BudgetSetupMobile } from '../components/budget/BudgetSetupMobile';
import { TriageInboxMobile } from '../components/budget/TriageInboxMobile';
import { ImportSummaryMobile } from '../components/budget/ImportSummaryMobile';
import { BudgetOverviewMobile } from '../components/budget/BudgetOverviewMobile';
import { InsightsMobile } from '../components/budget/InsightsMobile';
import { TimePeriodButton } from '../components/budget/TimePeriodButton';
import { periodChoices, periodChoiceValue, periodFromChoice, presetLabel } from '../components/budget/periodChoices';

type BudgetTab = 'overview' | 'insights' | 'transactions' | 'setup';

// Three tabs, one job each: look at the month, work through transactions,
// set the plan. Insights is one tap from This Month and keeps its own URL
// (?tab=insights), but is not a fourth tab.
const BUDGET_TABS: readonly TabItem<BudgetTab>[] = [
  { id: 'overview', label: 'This Month' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'setup', label: 'Plan' },
];

const isBudgetTab = (v: string | null): v is BudgetTab =>
  v === 'overview' || v === 'insights' || v === 'transactions' || v === 'setup';

export const Budgeting: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [excludedFocusRequest, setExcludedFocusRequest] = useState(0);
  const isDesktop = useIsDesktop();
  // Phone widths get a separate Setup layout; mounting only one avoids duplicate form ids.
  const isPhone = !useMediaQuery('(min-width: 768px)');
  const categories = useBudgetStore((state) => state.categories);
  const seedDefaults = useBudgetStore((state) => state.seedDefaults);

  // The tab lives in the URL so a tab is bookmarkable, Back undoes a tab
  // switch, and a reload does not throw the user back to Overview.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: BudgetTab = isBudgetTab(tabParam) ? tabParam : 'overview';
  const setTab = (next: BudgetTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params);
  };

  const currentMonth = monthKeyOf(new Date());
  const [period, setPeriod] = useState<Period>({ kind: 'month', month: currentMonth });
  const range = rangeOf(period);

  const shiftMonth = (delta: number) => {
    if (period.kind !== 'month') return;
    setPeriod({ kind: 'month', month: shiftMonthKey(period.month, delta) });
  };

  const formattedMonth = period.kind === 'month'
    ? new Date(`${period.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : `${range.from} to ${range.to}`;

  const choices = periodChoices(period, currentMonth, formattedMonth);
  const choiceValue = periodChoiceValue(period, currentMonth);
  const chooseValue = (v: string) => {
    const next = periodFromChoice(v, currentMonth);
    if (next) setPeriod(next);
  };

  React.useEffect(() => {
    if (Object.keys(categories).length === 0) {
      seedDefaults();
    }
  }, [categories, seedDefaults]);

  // On a phone the stepper is page chrome, so it drops the card and keeps only
  // the 44px hit areas. Desktop keeps the bordered card exactly as it was.
  const phoneMonthStepper = period.kind === 'month' && (
    <div className="flex items-center">
      <button
        onClick={() => shiftMonth(-1)}
        className="h-11 w-11 flex items-center justify-center rounded-md text-text-secondary hover:text-accent transition-colors duration-200"
        aria-label="Previous Month"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="text-[15px] font-medium tabular-nums text-center">{formattedMonth}</span>
      <button
        onClick={() => shiftMonth(1)}
        className="h-11 w-11 flex items-center justify-center rounded-md text-text-secondary hover:text-accent transition-colors duration-200"
        aria-label="Next Month"
      >
        <ChevronRight size={20} />
      </button>
      {period.month !== currentMonth && (
        <button
          onClick={() => setPeriod({ kind: 'month', month: currentMonth })}
          className="h-11 px-2 rounded-md text-[12px] font-medium text-accent hover:bg-bg-secondary transition-colors duration-200"
        >
          Today
        </button>
      )}
    </div>
  );

  const monthStepper = period.kind === 'month' && (
    <div className="flex items-center gap-1 md:h-10 bg-bg-secondary rounded-lg p-1 border border-border shadow-sm">
      <button
        onClick={() => shiftMonth(-1)}
        className="h-11 w-11 md:h-8 md:w-8 flex items-center justify-center rounded-md hover:bg-bg-primary text-text-secondary hover:text-accent transition-all duration-200"
        aria-label="Previous Month"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-[14px] font-medium md:min-w-[120px] text-center">{formattedMonth}</span>
      <button
        onClick={() => shiftMonth(1)}
        className="h-11 w-11 md:h-8 md:w-8 flex items-center justify-center rounded-md hover:bg-bg-primary text-text-secondary hover:text-accent transition-all duration-200"
        aria-label="Next Month"
      >
        <ChevronRight size={16} />
      </button>
      {period.month !== currentMonth && (
        <button
          onClick={() => setPeriod({ kind: 'month', month: currentMonth })}
          className="px-2 py-1 rounded-md text-[12px] font-medium text-accent hover:bg-bg-primary transition-all duration-200"
        >
          Today
        </button>
      )}
    </div>
  );

  const insightsLink = (
    <button type="button" onClick={() => setTab('insights')} className="themed-card !border-0 flex items-center gap-3 p-4 min-h-[64px] text-left active:opacity-60">
      <span className="w-9 h-9 shrink-0 rounded-full bg-accent text-bg-primary flex items-center justify-center"><ChartNoAxesCombined className="w-5 h-5" aria-hidden="true" /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-[17px] font-semibold">Insights</span>
        <span className="block text-[14px] text-text-secondary">Cash flow, savings rate, subscriptions and trends.</span>
      </span>
      <ChevronRight className="w-5 h-5 shrink-0 text-text-secondary" aria-hidden="true" />
    </button>
  );

  return (
    <div className="flex flex-col gap-6 w-full min-h-full animate-fade-in">
      <PageHeader
        title="Budgeting"
        subtitle="Manage your income, track expenses, and view your cash flow."
        actions={
          <>
            {/* The preset dropdown was `hidden md:block`. It is now desktop
                only by construction, so the 932x430 short-wide layout follows
                the phone rules like every other phone-layout width. */}
            <div data-period-dropdown>
              <ThemedSelect
                ariaLabel="Time period"
                value={choiceValue}
                onChange={chooseValue}
                className="h-10 text-[13px]"
                options={choices}
              />
            </div>
            {monthStepper}
            <CSVUploader />
            <button
              onClick={() => setIsModalOpen(true)}
              className="h-10 px-4 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
            >
              Add Transaction
            </button>
          </>
        }
        phoneAction={<TopBarAction icon={Plus} label="Add Transaction" onClick={() => setIsModalOpen(true)} />}
      />

      {/* Rule 1 of docs/mobile-layout-rules.md: secondary controls share one
          row at the top of the page. Rendered here or in the desktop header,
          never both, so CSVUploader's dialog exists once. */}
      {!isDesktop && (
        <div data-testid="budget-phone-controls" className="flex flex-wrap items-center justify-between gap-2 -mb-[22px]">
          {period.kind === 'month' ? phoneMonthStepper : <span className="px-3 text-[15px] font-medium">{presetLabel(period.preset)}</span>}
          <div className="flex items-center">
            <TimePeriodButton choices={choices} value={choiceValue} onChange={chooseValue} />
            <CSVUploader />
          </div>
        </div>
      )}

      <Tabs items={BUDGET_TABS} value={tab} onChange={setTab} ariaLabel="Budgeting sections" />
      {isPhone ? <ImportSummaryMobile onViewExcluded={() => { setTab('transactions'); setExcludedFocusRequest(value => value + 1); }} /> : <ImportSummary onViewExcluded={() => { setTab('transactions'); setExcludedFocusRequest(value => value + 1); }} />}

      {tab === 'overview' && (
        <TabPanel id="overview" className="flex flex-col gap-6">
          {!isDesktop ? (
            <BudgetOverviewMobile range={range} attention={<NeedsAttentionCard />} bills={<BillsThisMonthCard month={range.to} />} />
          ) : (<>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <IncomeWidget range={range} />
            <ExpenseWidget range={range} />
            <div className="order-first md:order-none min-w-0">
              <MonthlySummaryWidget range={range} />
            </div>
          </div>

          <NeedsAttentionCard />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BudgetProgressWidget range={range} />
            <BillsThisMonthCard month={range.to} />
          </div>

          <OwedToMeWidget />
          </>)}
          {insightsLink}
        </TabPanel>
      )}

      {tab === 'insights' && (
        <TabPanel id="insights" className="flex flex-col gap-6">
          <button type="button" onClick={() => setTab('overview')} className="-mb-3 inline-flex items-center gap-0.5 self-start min-h-[44px] -ml-2 pr-2 text-[17px] text-accent">
            <ChevronLeft className="w-6 h-6" aria-hidden="true" /> This Month
          </button>
          <h2 className="text-[22px] font-bold tracking-tight -mb-2">Insights</h2>
          {!isDesktop ? (<>
            <InsightsMobile range={range} />
            <CashFlowWidget range={range} />
            <SavingsRateMobile range={range} />
          </>) : (<>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CashFlowWidget range={range} />
            <SavingsRateWidget range={range} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SubscriptionsWidget />
            <AnomalyAlertsWidget range={range} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SpendingHeatmapWidget range={range} />
            <CategoryTrendsWidget range={range} />
          </div>
          </>)}
        </TabPanel>
      )}

      {tab === 'transactions' && (
        <TabPanel id="transactions" className="flex flex-col gap-6">
          <NeedsAttentionCard />
          {isPhone ? <TriageInboxMobile /> : <TriageInboxWidget />}
          <ExcludedImportsWidget focusRequest={excludedFocusRequest} />

          <TransactionListWidget range={range} />
        </TabPanel>
      )}

      {tab === 'setup' && (
        <TabPanel id="setup" className="flex flex-col gap-6">
          <CashPlanWidget />
          <ParadigmBanner selectedMonth={range.to} />
          {isPhone ? (
            <BudgetSetupMobile selectedMonth={range.to} />
          ) : (
            <>
              <CategoryManagerWidget selectedMonth={range.to} />

              <ReallocationHistory selectedMonth={range.to} />

              <CategorizationRulesWidget />
              <ExclusionRulesWidget />
            </>
          )}
        </TabPanel>
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
