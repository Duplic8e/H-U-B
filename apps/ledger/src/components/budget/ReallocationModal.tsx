import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useBudgetStore, getMonthlyBudgetStats } from '../../store/useBudgetStore';
import { ThemedSelect } from '../ui/ThemedSelect';
import { NumberInput } from '../ui/NumberInput';
import { formatMoney } from '../planner/format';

interface ReallocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  toCategoryId: string;
  defaultAmount: number;
  selectedMonth: string; // YYYY-MM
}

export const ReallocationModal: React.FC<ReallocationModalProps> = ({
  isOpen,
  onClose,
  toCategoryId,
  defaultAmount,
  selectedMonth,
}) => {
  const state = useBudgetStore();
  const { categories, addReallocation } = state;
  const [year, month] = selectedMonth.split('-').map(Number);
  const stats = getMonthlyBudgetStats(state, year, month - 1);

  const sources = useMemo(
    () => Object.values(categories).filter((c) => c.id !== toCategoryId && stats.perCategory[c.id]),
    [categories, toCategoryId, stats.perCategory],
  );

  const [fromCategoryId, setFromCategoryId] = useState(sources[0]?.id ?? '');
  const [amount, setAmount] = useState(defaultAmount);
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const available = (id: string) => {
    const s = stats.perCategory[id];
    return s ? s.effectiveTarget - s.spent : 0;
  };
  const target = categories[toCategoryId];
  const short = fromCategoryId && amount > available(fromCategoryId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromCategoryId || amount <= 0) return;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const date =
      todayKey === selectedMonth
        ? `${todayKey}-${String(today.getDate()).padStart(2, '0')}`
        : `${selectedMonth}-01`;
    addReallocation({
      id: crypto.randomUUID(),
      fromCategoryId,
      toCategoryId,
      amount,
      date,
      note: note || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-bg-secondary border border-border rounded-xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Cover overspending"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-text-primary">
            Cover overspending{target ? ` in ${target.name}` : ''}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-text-secondary">Move budget from</label>
            <ThemedSelect
              value={fromCategoryId}
              onChange={setFromCategoryId}
              options={sources.map((c) => ({
                value: c.id,
                label: `${c.name} (${formatMoney(available(c.id))} available)`,
              }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-text-secondary">Amount</label>
            <NumberInput
              value={amount}
              onCommit={setAmount}
              className="bg-bg-primary border border-border rounded px-3 py-1.5 text-[14px] focus:outline-none focus:border-accent"
            />
            {short && (
              <p className="text-[12px] text-error">
                That is more than this category has available. You can still move it; the source
                will show as overspent.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-text-secondary">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-bg-primary border border-border rounded px-3 py-1.5 text-[14px] focus:outline-none focus:border-accent"
              placeholder="e.g. groceries ran hot this month"
            />
          </div>

          <button
            type="submit"
            className="mt-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Move Budget
          </button>
        </form>
      </div>
    </div>
  );
};
