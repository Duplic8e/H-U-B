import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useBudgetStore } from '../../store/useBudgetStore';
import { formatMoney } from '../planner/format';

export const ReallocationHistory: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const reallocations = useBudgetStore((s) => s.reallocations);
  const categories = useBudgetStore((s) => s.categories);
  const deleteReallocation = useBudgetStore((s) => s.deleteReallocation);
  const [collapsed, setCollapsed] = useState(false);

  const rows = Object.values(reallocations)
    .filter((r) => r.date.startsWith(selectedMonth))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (rows.length === 0) return null;

  const name = (id: string) => categories[id]?.name ?? 'Deleted category';

  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="flex items-center gap-2 text-left"
      >
        {collapsed ? (
          <ChevronRight size={18} className="text-text-secondary" />
        ) : (
          <ChevronDown size={18} className="text-text-secondary" />
        )}
        <h2 className="text-[16px] font-semibold text-text-primary">Reallocations This Month</h2>
      </button>
      {!collapsed && rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 text-[13px] border-b border-border/30 pb-2 last:border-0 last:pb-0">
          <span className="text-text-primary">{name(r.fromCategoryId)}</span>
          <ArrowRight size={14} className="text-text-secondary shrink-0" />
          <span className="text-text-primary">{name(r.toCategoryId)}</span>
          <span className="font-medium text-text-primary ml-auto">{formatMoney(r.amount)}</span>
          {r.note && <span className="text-text-secondary italic truncate max-w-[180px]">{r.note}</span>}
          <span className="text-text-secondary">{r.date}</span>
          <button
            type="button"
            aria-label="Delete reallocation"
            onClick={() => deleteReallocation(r.id)}
            className="p-1 text-text-secondary hover:text-error transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
