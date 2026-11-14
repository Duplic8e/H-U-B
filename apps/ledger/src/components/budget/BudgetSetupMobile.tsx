import React, { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useBudgetStore, getMonthlyBudgetStats } from '../../store/useBudgetStore';
import { totalMonthlyBudget } from '../../store/budgetSelectors';
import { useUndoStore } from '../../store/useUndoStore';
import { formatMoney, formatMoneyWithCents } from '../planner/format';
import { categoryExpenseBreakdown } from '../../utils/budget/categoryStats';
import { countsAsIncome } from '../../utils/budget/sharedExpenses';
import { cadenceOf, monthlyEquivalent } from '../../utils/budget/cadence';
import { CategoryOptionsButton } from './CategoryOptionsSheet';
import { isBillCategory } from '../../utils/budget/bills';
import { useDetectedBillIds } from '../../hooks/useBillIds';
import { amountForCategory } from '../../utils/budget/splits';
import { NumberInput } from '../ui/NumberInput';
import { ThemedSelect } from '../ui/ThemedSelect';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Sheet } from '../ui/Sheet';
import { RenameSheet } from './CategoryEditSheets';
import { CategorizationRulesWidget } from './CategorizationRulesWidget';
import { ExclusionRulesWidget } from './ExclusionRulesWidget';
import { ReallocationHistory } from './ReallocationHistory';
import { ReallocationModal } from './ReallocationModal';
import { PARADIGM_DESCRIPTIONS } from './paradigmDescriptions';
import type { BudgetClass, BudgetingParadigm, Category } from '../../types/budget';

const BUDGET_CLASSES: BudgetClass[] = ['need', 'want', 'savings'];
const PARADIGM_OPTIONS: { value: BudgetingParadigm; label: string }[] = [
  { value: 'Ledger Custom', label: 'Ledger Custom' },
  { value: 'Zero-Based', label: 'Zero-Based' },
  { value: 'Target-Based', label: 'Target-Based' },
  { value: '50/30/20', label: '50/30/20 Rule' },
];
const SEGMENTS = ['Targets', 'Categories', 'Rules'] as const;
type Segment = (typeof SEGMENTS)[number];

const inputCls = 'w-full min-h-[44px] bg-bg-primary border border-border rounded-lg px-3 text-[14px] focus:border-accent';
const iconBtn = 'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-bg-secondary border border-border rounded-xl overflow-hidden ${className}`}>{children}</div>
);

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[12px] border border-border rounded-full px-2 text-text-secondary tabular-nums">{children}</span>
);

interface Props {
  selectedMonth: string;
}

/** Phone layout for Budgeting > Setup. The desktop CategoryManagerWidget stays the
 *  source of truth above the md breakpoint; this is a separate phone-first view over
 *  the same store, split into three sections so each one is short. */
export const BudgetSetupMobile: React.FC<Props> = ({ selectedMonth }) => {
  const state = useBudgetStore();
  const detectedBills = useDetectedBillIds();
  const { transactions, categories, categoryGroups, paradigm, reallocations } = state;
  const offerUndo = useUndoStore((s) => s.offerUndo);
  const [segment, setSegment] = useState<Segment>('Targets');
  const [coverTarget, setCoverTarget] = useState<{ id: string; overage: number } | null>(null);
  const [paradigmInfoOpen, setParadigmInfoOpen] = useState(false);
  const [removing, setRemoving] = useState<{ kind: 'category' | 'group'; id: string } | null>(null);
  const [renaming, setRenaming] = useState<{ kind: 'category' | 'group'; id: string; name: string } | null>(null);

  const [year, month] = selectedMonth.split('-').map(Number);
  const stats = getMonthlyBudgetStats(state, year, month - 1);
  const monthTx = Object.values(transactions).filter((t) => t.date.startsWith(selectedMonth));
  const expenses = monthTx.filter((t) => t.type === 'expense');
  const income = monthTx.filter((t) => countsAsIncome(t));
  const monthReallocs = Object.values(reallocations).filter((r) => r.date.startsWith(selectedMonth));

  const groups = Object.values(categoryGroups).map((g) => {
    const isIncome = g.kind === 'income';
    const rows = Object.values(categories)
      .filter((c) => c.groupId === g.id)
      .map((cat) => {
        const spent = (isIncome ? income : expenses).reduce((n, t) => n + amountForCategory(t, cat.id), 0);
        const target =
          monthlyEquivalent(cat) +
          monthReallocs.filter((r) => r.toCategoryId === cat.id).reduce((n, r) => n + r.amount, 0) -
          monthReallocs.filter((r) => r.fromCategoryId === cat.id).reduce((n, r) => n + r.amount, 0);
        return { cat, spent, target };
      });
    return { group: g, isIncome, rows, planned: rows.reduce((n, r) => n + monthlyEquivalent(r.cat), 0) };
  });

  const removeName = removing
    ? removing.kind === 'category'
      ? categories[removing.id]?.name
      : categoryGroups[removing.id]?.name
    : '';

  const confirmRemove = () => {
    if (!removing) return;
    if (removing.kind === 'category') {
      const removed = categories[removing.id];
      state.deleteCategory(removing.id);
      offerUndo(`Deleted category "${removed.name}"`, () => state.addCategory(removed));
    } else {
      const removed = categoryGroups[removing.id];
      state.deleteCategoryGroup(removing.id);
      offerUndo(`Deleted group "${removed.name}"`, () => state.addCategoryGroup(removed));
    }
    setRemoving(null);
  };

  const targetInput = (cat: Category) => (
    <NumberInput
      value={cat.targetAmount}
      onCommit={(n) => state.updateCategory(cat.id, { targetAmount: n })}
      aria-label={`${cat.name} target`}
      className="w-24 min-h-[44px] bg-bg-secondary border border-border rounded-lg px-3 text-[14px] text-right focus:border-accent"
    />
  );

  const cadenceToggle = (cat: Category) => (
    <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
      {(['monthly', 'annual'] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Budget ${cat.name} ${c === 'monthly' ? 'monthly' : 'annually'}`}
          aria-pressed={cadenceOf(cat) === c}
          onClick={() => state.updateCategory(cat.id, { cadence: c })}
          className={`px-3 min-h-[44px] text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            cadenceOf(cat) === c ? 'bg-accent/15 text-accent' : 'text-text-secondary'
          }`}
        >
          {c === 'monthly' ? '/mo' : '/yr'}
        </button>
      ))}
    </div>
  );

  const targetsPane = (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="p-3">
        <div className="flex items-center gap-1">
          <span className="text-[13px] text-text-secondary">Paradigm</span>
          <button
            type="button"
            aria-label="About budgeting paradigms"
            aria-haspopup="dialog"
            onClick={() => setParadigmInfoOpen(true)}
            className="min-w-[44px] min-h-[44px] -mx-2 flex items-center justify-center text-accent rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-accent flex items-center justify-center font-serif italic font-bold text-[13px]" aria-hidden="true">i</span>
          </button>
          <div className="flex-1" />
          <ThemedSelect
            ariaLabel="Paradigm"
            value={paradigm}
            onChange={(v) => state.setParadigm(v as BudgetingParadigm)}
            className="min-w-[150px]"
            options={PARADIGM_OPTIONS}
          />
        </div>
        </div>
        <div className="flex items-center justify-between bg-bg-primary/60 border-t border-border px-3 min-h-[48px]">
          <span className="text-[13px] text-text-secondary">Total Monthly Budget</span>
          <span className="text-[16px] font-semibold tabular-nums">{formatMoney(totalMonthlyBudget(categories, categoryGroups))}</span>
        </div>
      </Card>
      {groups.filter((g) => !g.isIncome).map(({ group, rows, planned }) => (
        <Card key={group.id}>
          <div className="flex items-center gap-2 px-3.5 min-h-[44px] border-b border-border">
            <span className="flex-1">{group.name}</span>
            {paradigm === '50/30/20' &&
              BUDGET_CLASSES.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  aria-label={`Set ${group.name} class to ${cls}`}
                  aria-pressed={group.budgetClass === cls}
                  onClick={() => state.updateCategoryGroup(group.id, { budgetClass: cls })}
                  className={`px-2.5 min-h-[44px] text-[12px] capitalize ${group.budgetClass === cls ? 'text-accent' : 'text-text-secondary'}`}
                >
                  {cls}
                </button>
              ))}
            <Pill>{formatMoney(planned)}</Pill>
          </div>
          {rows.length === 0 && <p className="px-3.5 min-h-[56px] flex items-center text-[12px] italic text-text-secondary">No categories.</p>}
          {rows.map(({ cat, spent, target }) => {
            const over = target > 0 && spent > target;
            const breakdown = categoryExpenseBreakdown(transactions, cat.id, selectedMonth);
            const overspend = stats.perCategory[cat.id]?.overspend ?? 0;
            return (
              <div key={cat.id} className="flex flex-wrap items-center gap-2 px-3.5 py-2 border-b border-border last:border-0">
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px]">{cat.name}</span>
                    {group.kind === 'expense' && isBillCategory(cat, detectedBills) && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[12px] font-semibold text-accent">Bill</span>}
                  </span>
                  <span className={`block text-[12px] ${over ? 'text-error' : 'text-text-secondary'}`}>
                    {spent < 0 ? `${formatMoneyWithCents(-spent)} net credit` : `${formatMoney(spent)} spent`}
                    {over && ` (${formatMoney(spent - target)} over)`}
                  </span>
                  {breakdown.offsets > 0 && (
                    <span className="block text-[12px] text-text-secondary">
                      {formatMoneyWithCents(breakdown.purchases)} purchases · {formatMoneyWithCents(breakdown.offsets)} refunds &amp; payments
                    </span>
                  )}
                </span>
                {targetInput(cat)}
                {group.kind === 'expense' ? (
                  <>
                    <CategoryOptionsButton category={cat} detected={detectedBills.has(cat.id)} onPayment={(billing) => state.updateCategory(cat.id, { billing })} onCadence={(cadence) => state.updateCategory(cat.id, { cadence })} />
                  </>
                ) : cadenceToggle(cat)}
                {paradigm === 'Zero-Based' && overspend > 0 && (
                  <button type="button" onClick={() => setCoverTarget({ id: cat.id, overage: overspend })} className="min-h-[44px] px-3 rounded-lg border border-error/60 text-error text-[13px] font-medium">
                    Cover
                  </button>
                )}
                {paradigm === 'Target-Based' && overspend > 0 && <span className="text-[12px] text-orange-500">absorbed by buffer</span>}
                {target > 0 && (
                  <div className="w-full h-1 bg-bg-primary border border-border/50 rounded-full overflow-hidden">
                    <div className={`h-full ${over ? 'bg-error' : 'bg-accent'}`} style={{ width: `${Math.max(0, Math.min(100, (spent / target) * 100))}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );

  const categoriesPane = (
    <div className="flex flex-col gap-3">
      {groups.map(({ group, rows }) => (
        <Card key={group.id}>
          <div className="flex items-center gap-2 pl-3.5 pr-1 min-h-[48px] border-b border-border">
            <span className="flex-1">{group.name}</span>
            <button type="button" aria-label={`Rename group ${group.name}`} onClick={() => setRenaming({ kind: 'group', id: group.id, name: group.name })} className={iconBtn}>
              <Pencil size={16} aria-hidden="true" />
            </button>
            {rows.length === 0 ? (
              <>
                <Pill>{rows.length}</Pill>
                <button type="button" aria-label={`Remove group ${group.name}`} onClick={() => setRemoving({ kind: 'group', id: group.id })} className={iconBtn}>
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </>
            ) : (
              <div className="min-w-[44px] flex justify-center"><Pill>{rows.length}</Pill></div>
            )}
          </div>
          {rows.map(({ cat }) => (
            <div key={cat.id} className="flex items-center gap-2 pl-3.5 pr-1 min-h-[56px] border-b border-border">
              <span className="flex-1 truncate text-[14px]">{cat.name}</span>
              <button type="button" aria-label={`Rename category ${cat.name}`} onClick={() => setRenaming({ kind: 'category', id: cat.id, name: cat.name })} className={iconBtn}>
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button type="button" aria-label={`Remove category ${cat.name}`} onClick={() => setRemoving({ kind: 'category', id: cat.id })} className={iconBtn}>
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </div>
          ))}
          <InlineAdd
            label="Add Category"
            placeholder="Category name"
            onAdd={(name) => state.addCategory({ id: crypto.randomUUID(), groupId: group.id, name, targetAmount: 0 })}
          />
        </Card>
      ))}
      <AddGroup onAdd={(name, kind) => state.addCategoryGroup({ id: crypto.randomUUID(), name, kind })} />
    </div>
  );

  const rulesPane = (
    <div className="flex flex-col gap-3">
      <Card className="p-3.5"><CategorizationRulesWidget /></Card>
      <Card className="p-3.5"><ExclusionRulesWidget /></Card>
      <Card className="p-3.5 empty:hidden"><ReallocationHistory selectedMonth={selectedMonth} /></Card>
    </div>
  );

  return (
    <div data-testid="budget-setup-mobile">
      <div role="tablist" aria-label="Setup sections" className="flex bg-bg-secondary border border-border rounded-xl p-1 mb-4">
        {SEGMENTS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={segment === k}
            onClick={() => setSegment(k)}
            className={`flex-1 min-h-[44px] rounded-lg text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              segment === k ? 'bg-bg-primary text-text-primary' : 'text-text-secondary'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      {segment === 'Targets' && targetsPane}
      {segment === 'Categories' && categoriesPane}
      {segment === 'Rules' && rulesPane}

            <Sheet open={paradigmInfoOpen} onClose={() => setParadigmInfoOpen(false)} ariaLabel="Budgeting paradigms">
        <div className="flex flex-col divide-y divide-border">
          {PARADIGM_OPTIONS.map((o) => (
            <div key={o.value} className="py-2.5 first:pt-0 last:pb-0">
              <b className={`text-[13px] ${o.value === paradigm ? 'text-accent' : ''}`}>{o.label}</b>
              <p className="text-[12px] text-text-secondary mt-0.5">{PARADIGM_DESCRIPTIONS[o.value]}</p>
            </div>
          ))}
        </div>
      </Sheet>
      <RenameSheet
        open={renaming !== null}
        what={renaming?.kind ?? 'category'}
        current={renaming?.name ?? ''}
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          if (!renaming) return;
          if (renaming.kind === 'group') state.updateCategoryGroup(renaming.id, { name });
          else state.updateCategory(renaming.id, { name });
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={removing?.kind === 'group' ? 'Remove Group?' : 'Remove Category?'}
        message={
          removing?.kind === 'group'
            ? `"${removeName}" is empty and will no longer appear in Setup.`
            : 'Its transactions stay, but become uncategorized.'
        }
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
      {coverTarget && (
        <ReallocationModal
          isOpen
          onClose={() => setCoverTarget(null)}
          toCategoryId={coverTarget.id}
          defaultAmount={coverTarget.overage}
          selectedMonth={selectedMonth}
        />
      )}
    </div>
  );
};

interface InlineAddProps {
  label: string;
  placeholder: string;
  onAdd: (name: string) => void;
}

const InlineAdd: React.FC<InlineAddProps> = ({ label, placeholder, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
    setOpen(false);
  };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[48px] flex items-center justify-center gap-1.5 text-[13px] text-accent border-t border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Plus size={15} aria-hidden="true" />
        {label}
      </button>
    );
  }
  return (
    <div className="p-2.5 flex flex-col gap-2 border-t border-border">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          aria-label={`${label} name`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={placeholder}
          className={inputCls}
        />
        <button type="button" aria-label={`Confirm ${label}`} onClick={submit} className={`${iconBtn} text-accent`}>
          <Check size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label={`Cancel ${label}`} onClick={() => { setOpen(false); setValue(''); }} className={iconBtn}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

const AddGroup: React.FC<{ onAdd: (name: string, kind: 'expense' | 'income') => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const close = () => {
    setOpen(false);
    setValue('');
  };
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim(), kind);
    close();
  };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[48px] flex items-center justify-center gap-1.5 text-[13px] font-semibold text-accent bg-accent/10 border border-accent/35 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Plus size={15} aria-hidden="true" />
        Add Group
      </button>
    );
  }
  return (
    <Card className="!border-accent/45">
      <div className="flex items-center gap-2 pl-3.5 min-h-[48px] border-b border-border">
        <input
          autoFocus
          aria-label="Add Group name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Group name"
          className="flex-1 min-w-0 min-h-[44px] bg-transparent text-[14px] !border-0 !shadow-none !outline-none !ring-0"
        />
        <button type="button" aria-label="Confirm Add Group" onClick={submit} className={`${iconBtn} text-accent`}>
          <Check size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Cancel Add Group" onClick={close} className={iconBtn}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center pl-3.5 pr-1.5 min-h-[52px]">
        <span className="flex-1 text-[12px] text-text-secondary">Type</span>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`px-4 min-h-[44px] text-[12px] capitalize ${kind === k ? 'bg-accent/15 text-accent' : 'text-text-secondary'}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
};
