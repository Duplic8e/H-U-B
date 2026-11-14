import React from 'react';
import { WidgetWrapper } from '../dashboard/WidgetWrapper';
import { useBudgetStore } from '../../store/useBudgetStore';
import { detectRecurring } from '../../utils/budget/recurring';
import { forecastMonthEnd } from '../../utils/budget/cashFlowForecast';
import { unpaidBillsThisMonth } from '../../utils/budget/cashPlan';
import { useRecurringStore } from '../../store/useRecurringStore';
import { formatMoney } from '../planner/format';
import { countsAsIncome } from '../../utils/budget/sharedExpenses';
import { inRange, isSingleMonth, monthKeyOf, type MonthRange } from '../../utils/budget/period';

interface MonthlySummaryWidgetProps {
  range: MonthRange;
}

export const MonthlySummaryWidget: React.FC<MonthlySummaryWidgetProps> = ({ range }) => {
  const transactions = useBudgetStore((state) => state.transactions);

  const transactionsList = Object.values(transactions);

  const thisMonthTransactions = transactionsList.filter(t => inRange(t.date, range));

  const totalIncome = thisMonthTransactions
    .filter(t => countsAsIncome(t))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = thisMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netChange = totalIncome - totalExpense;
  const isPositive = netChange >= 0;

  const today = new Date().toISOString().slice(0, 10);
  const showForecast = isSingleMonth(range) && range.to === monthKeyOf(new Date());
  const plannedBills = useRecurringStore((s) => s.plannedBills);
  const detected = detectRecurring(transactions);
  const forecast = forecastMonthEnd(transactions, detected, range.to, today,
    unpaidBillsThisMonth(plannedBills, transactions, range.to, detected.map((d) => d.description)));
  const pendingSummary = forecast.pending
    .slice(0, 5)
    .map((p) => `${p.expectedDate}: ${p.type === 'income' ? `+${formatMoney(p.amount)}` : formatMoney(-p.amount)} ${p.description}`)
    .join('\n');

  return (
    <WidgetWrapper title="Monthly Summary">
      <div className="flex flex-col h-full pt-2">
        <div className="flex flex-col gap-2 mb-3 border-b border-border pb-3">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              <span className="text-text-secondary">Money In</span>
            </div>
            <span className="font-medium text-text-primary">
              +{formatMoney(totalIncome)}
            </span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-error"></div>
              <span className="text-text-secondary">Money Out</span>
            </div>
            <span className="font-medium text-text-primary">
              {formatMoney(-totalExpense)}
            </span>
          </div>

          {showForecast && (
            <div
              className="flex justify-between items-center text-sm"
              title={pendingSummary || 'No pending recurring items detected'}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent/50"></div>
                <span className="text-text-secondary">Projected Net</span>
              </div>
              <span className={`font-medium ${forecast.projectedNet >= 0 ? 'text-text-primary' : 'text-error'}`}>
                {forecast.projectedNet >= 0 ? '+' : '-'}{formatMoney(Math.abs(forecast.projectedNet))}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-end mt-auto">
          <span className="text-sm font-medium text-text-secondary">Net Change</span>
          <span data-key-figure className={`text-[20px] font-bold ${isPositive ? 'text-accent' : 'text-error'}`}>
            {isPositive ? '+' : '-'}{formatMoney(Math.abs(netChange))}
          </span>
        </div>
      </div>
    </WidgetWrapper>
  );
};
