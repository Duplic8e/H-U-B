import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useBudgetStore, getMonthlyBudgetStats } from '../../store/useBudgetStore';
import { formatMoney } from '../planner/format';

const Banner: React.FC<{ tone: 'info' | 'warn'; children: React.ReactNode; footer?: React.ReactNode }> = ({
  tone,
  children,
  footer,
}) => (
  <div
    className={`rounded-lg border px-4 py-3 text-[13px] ${
      tone === 'warn'
        ? 'border-error/50 bg-error/10 text-text-primary'
        : 'border-border bg-bg-secondary text-text-primary'
    }`}
  >
    <div className="flex items-start gap-2">
      {tone === 'warn' ? (
        <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
      ) : (
        <Info size={16} className="text-text-secondary shrink-0 mt-0.5" />
      )}
      <div className="flex flex-col gap-2 min-w-0 flex-1">{children}</div>
    </div>
    {footer && <div className="mt-2">{footer}</div>}
  </div>
);

export const ParadigmBanner: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const state = useBudgetStore();
  const [year, month] = selectedMonth.split('-').map(Number);
  const stats = getMonthlyBudgetStats(state, year, month - 1);

  if (state.paradigm === 'Ledger Custom') return null;

  if (state.paradigm === 'Zero-Based') {
    const { unassigned } = stats.zeroBased;
    if (unassigned === 0) return null;
    return unassigned > 0 ? (
      <Banner tone="info">
        <span>
          <strong>{formatMoney(unassigned)} unassigned.</strong> Assign it to a category so every
          dollar has a job.
        </span>
      </Banner>
    ) : (
      <Banner tone="warn">
        <span>
          You have assigned {formatMoney(Math.abs(unassigned))} more than you earned this month.
          Lower some targets or log the missing income.
        </span>
      </Banner>
    );
  }

  if (state.paradigm === 'Target-Based') {
    const { buffer, negative } = stats.targetBased;
    return negative ? (
      <Banner tone="warn">
        <span>
          Your buffer is {formatMoney(buffer)}. Spending has exceeded income plus targets; trim
          spending or raise income to get back above zero.
        </span>
      </Banner>
    ) : (
      <Banner tone="info">
        <span>
          <strong>{formatMoney(buffer)} buffer</strong> available this month. Overspending in any
          category draws from it automatically.
        </span>
      </Banner>
    );
  }

  // 50/30/20
  const f = stats.fiftyThirtyTwenty;
  const buckets = [
    { label: 'Needs', pct: f.needsPct, target: 50, color: 'bg-accent' },
    { label: 'Wants', pct: f.wantsPct, target: 30, color: 'bg-accent/70' },
    { label: 'Savings', pct: f.savingsPct, target: 20, color: 'bg-accent/40' },
  ];
  return (
    <Banner
      tone="info"
      footer={
        <div data-testid="ratio-bar" className="flex w-full h-2 rounded overflow-hidden bg-bg-primary/50">
          {buckets.map((b) => (
            <div key={b.label} className={b.color} style={{ width: `${Math.max(0, Math.min(b.pct, 100))}%` }} />
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {buckets.map((b) => (
          <span key={b.label} className={b.pct > b.target ? 'text-error' : ''}>
            {b.label} {Math.round(b.pct)}%
            <span className="text-text-secondary"> / {b.target}% target</span>
          </span>
        ))}
      </div>
      {f.hasUnclassified && (
        <span className="text-[12px] text-text-secondary">
          Some expense groups have no class yet. Set Need / Want / Savings chips in Budget Setup for
          accurate buckets (unclassified counts as Needs).
        </span>
      )}
    </Banner>
  );
};
