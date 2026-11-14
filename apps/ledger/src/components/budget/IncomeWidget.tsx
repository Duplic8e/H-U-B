import React, { useId } from 'react';
import { WidgetWrapper } from '../dashboard/WidgetWrapper';
import { useBudgetStore } from '../../store/useBudgetStore';
import { formatMoney } from '../planner/format';
import { countsAsIncome } from '../../utils/budget/sharedExpenses';
import { inRange, isSingleMonth, type MonthRange } from '../../utils/budget/period';
import { splitParts } from '../../utils/budget/splits';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { PHONE_LIST_LIMIT, useShowMore } from '../../hooks/useShowMore';
import { ShowMoreButton } from '../ui/ShowMoreButton';

interface IncomeWidgetProps {
  range: MonthRange;
}

export const IncomeWidget: React.FC<IncomeWidgetProps> = ({ range }) => {
  const transactions = useBudgetStore((state) => state.transactions);
  const categories = useBudgetStore((state) => state.categories);

  const incomeThisMonth = Object.values(transactions).filter(t => countsAsIncome(t) && inRange(t.date, range));

  const totalIncome = incomeThisMonth.reduce((sum, t) => sum + t.amount, 0);

  // Break down by income category (Salary, RSU, ...) so you can see the source.
  const incomeBySource = incomeThisMonth.reduce((acc, t) => {
    for (const part of splitParts(t)) {
      const name = (part.categoryId && categories[part.categoryId]?.name) || 'Other income';
      acc[name] = (acc[name] || 0) + part.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedSources = Object.entries(incomeBySource).sort((a, b) => b[1] - a[1]);

  // Rule 4 of docs/mobile-layout-rules.md. Desktop keeps the fixed-height
  // scroll list so the three Overview cards line up; on a phone a scroll
  // area inside the scrolling page traps the thumb, so the list is capped
  // and expands in place instead.
  const isDesktop = useIsDesktop();
  const list = useShowMore(sortedSources, PHONE_LIST_LIMIT, !isDesktop);
  const listId = useId();

  return (
    <WidgetWrapper title="Income">
      <div className="flex flex-col gap-4 mt-4 h-full">
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-bold text-accent">{formatMoney(totalIncome)}</span>
          <span className="text-[12px] text-text-secondary">{isSingleMonth(range) ? 'This Month' : `${range.from} to ${range.to}`}</span>
        </div>

        {sortedSources.length > 0 && (
          <div
            id={listId}
            role="group"
            aria-label="Income sources"
            tabIndex={isDesktop ? 0 : undefined}
            className={`flex flex-col gap-2 mt-2 rounded ${
              isDesktop ? 'overflow-y-auto max-h-[200px] pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent' : ''
            }`}
          >
            {list.visible.map(([source, amount]) => (
              <div key={source} className="flex justify-between items-center p-2 bg-bg-secondary rounded border border-border">
                <span className="text-[14px] text-text-primary">{source}</span>
                <span className="text-[14px] font-medium">{formatMoney(amount)}</span>
              </div>
            ))}
          </div>
        )}
        {list.truncates && (
          <ShowMoreButton total={sortedSources.length} noun="sources" expanded={list.expanded} onToggle={list.toggle} controls={listId} />
        )}
      </div>
    </WidgetWrapper>
  );
};
