import React from 'react';
import { WidgetWrapper } from '../WidgetWrapper';
import { useAccountsStore } from '../../../store/useAccountsStore';
import { useAccountValuation } from '../../../hooks/useAccountValuation';
import { netWorthTrend } from '../../../utils/accounts/accountValuation';
import { AnimatedNumber } from '../../ui/AnimatedNumber';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const NetWorthWidget: React.FC = () => {
  const history = useAccountsStore((s) => s.history);
  const valuation = useAccountValuation();

  const netWorth = valuation.netWorth;
  const trend = netWorthTrend(netWorth, history);
  const isPositive = trend !== null && trend >= 0;

  // Mirrors getNetWorthTrend's own notion of "a real figure": the most
  // recent snapshot at or before the end of last month must exist and be
  // non-zero. A naive "does any snapshot before the cutoff have a non-zero
  // value" check can disagree with that (an older non-zero snapshot behind a
  // newer zero-valued one), so this reuses the same most-recent-match logic
  // rather than a plain .some().
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const endOfLastMonth = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastMonthEnd.getDate()).padStart(2, '0')}`;
  const pastSnapshot = history.filter((h) => h.date <= endOfLastMonth).sort((a, b) => b.date.localeCompare(a.date))[0];
  const hasComparison = pastSnapshot !== undefined && pastSnapshot.value !== 0;

  return (
    <WidgetWrapper title="Net Worth" className="col-span-1 md:col-span-2 lg:col-span-1">
      <div className="flex flex-col justify-center h-full pt-4">
        <div data-key-figure className="[overflow-wrap:anywhere] text-[36px] font-bold leading-[1.1] text-text-primary mb-2">
          {netWorth === null ? 'Conversion Needed' : <AnimatedNumber
            value={netWorth}
            format={(n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />}
        </div>
        {trend !== null && hasComparison ? (
          <div className="flex flex-wrap items-center text-accent font-medium">
            {isPositive ? <TrendingUp size={16} className="mr-1" aria-hidden="true" /> : <TrendingDown size={16} className="mr-1 text-error" aria-hidden="true" />}
            <span className={isPositive ? '' : 'text-error'}>
              {isPositive ? '+' : ''}{trend.toFixed(2)}%
            </span>
            <span className="text-text-secondary ml-2 font-normal text-sm">vs Last Month</span>
          </div>
        ) : netWorth === null ? null : (
          // A green up-arrow reading "+0.00%" on a brand-new install reported
          // growth that never happened. Say there is nothing to compare to.
          <div className="text-text-secondary font-normal text-sm">No comparison for last month yet</div>
        )}
      </div>
    </WidgetWrapper>
  );
};
