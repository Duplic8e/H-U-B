import React, { useState } from 'react';
import { merchantLabel } from '../../utils/budget/merchant';
import { Trash2, Plus } from 'lucide-react';
import { WidgetWrapper } from '../dashboard/WidgetWrapper';
import { useTriageStore } from '../../store/useTriageStore';
import { useBudgetStore } from '../../store/useBudgetStore';
import { ThemedSelect } from '../ui/ThemedSelect';

const PHONE_CARD = 'max-md:!bg-transparent max-md:!border-0 max-md:!shadow-none max-md:!p-0';

export const CategorizationRulesWidget: React.FC = () => {
  const categoryRules = useTriageStore((state) => state.categoryRules);
  const learnRule = useTriageStore((state) => state.learnRule);
  const removeRule = useTriageStore((state) => state.removeRule);
  const categories = useBudgetStore((state) => state.categories);

  const [newDesc, setNewDesc] = useState('');
  const [newCatId, setNewCatId] = useState('');

  const rulesEntries = Object.entries(categoryRules);
  const categoryList = Object.values(categories);

  const handleAdd = () => {
    if (newDesc.trim() && newCatId) {
      learnRule(newDesc.trim(), newCatId);
      setNewDesc('');
      setNewCatId('');
    }
  };

  return (
    <WidgetWrapper title={`Categorization Rules (${rulesEntries.length})`} className={PHONE_CARD}>
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex flex-wrap max-md:flex-col gap-2">
          <label htmlFor="rule-desc-input" className="sr-only">Description match</label>
          <input
            id="rule-desc-input"
            type="text"
            placeholder="Description Match (e.g. UBER)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="flex-1 min-w-[140px] max-md:min-h-11 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-3 py-1.5 text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <label htmlFor="rule-category-select" className="sr-only">Category</label>
          <ThemedSelect
            id="rule-category-select"
            value={newCatId}
            onChange={setNewCatId}
            className="w-full sm:w-48"
            options={[
              { value: '', label: 'Select Category...' },
              ...categoryList.map(cat => ({ value: cat.id, label: cat.name })),
            ]}
          />
          <button
            onClick={handleAdd}
            disabled={!newDesc.trim() || !newCatId}
            aria-label="Add Rule"
            className="px-3 py-1.5 max-md:min-h-11 max-md:gap-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center"
          >
            <Plus size={16} /><span className="md:hidden text-[14px] font-semibold">Add Rule</span>
          </button>
        </div>

        <div className="flex flex-col max-h-[240px] desktop:max-h-[300px] max-md:max-h-none overflow-y-auto border border-[var(--color-border)] rounded-md">
          {rulesEntries.length === 0 ? (
            <div className="p-4 text-center text-[13px] text-[var(--color-text-secondary)]">No rules created yet.</div>
          ) : (
            rulesEntries.map(([desc, catId]) => {
              const catName = categories[catId]?.name || 'Unknown';
              return (
                <div key={desc} className="flex justify-between items-center gap-3 p-3 max-md:min-h-[56px] border-b border-[var(--color-border)] last:border-0 bg-[var(--color-bg-secondary)]">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium text-[var(--color-text-primary)]">{merchantLabel(desc)}</span>
                    <span className="text-[12px] text-[var(--color-text-secondary)]">Matches to: {catName}</span>
                  </div>
                  <button 
                    onClick={() => removeRule(desc)}
                    aria-label={`Delete rule ${desc}`}
                    className="p-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded bg-error/10 text-error hover:bg-error/20 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </WidgetWrapper>
  );
};
