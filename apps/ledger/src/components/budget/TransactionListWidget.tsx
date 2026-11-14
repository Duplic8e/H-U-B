import React, { useEffect, useRef, useState } from 'react';
import { useBudgetStore } from '../../store/useBudgetStore';
import { computeWindow } from '../../utils/virtualWindow';
import { TransactionModal } from './TransactionModal';
import type { Category, Transaction } from '../../types/budget';
import { Trash2, Maximize2, Minimize2, Receipt, Search } from 'lucide-react';
import { ThemedSelect } from '../ui/ThemedSelect';
import { formatMoney } from '../planner/format';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Checkbox } from '../ui/Checkbox';
import { ShowMoreButton } from '../ui/ShowMoreButton';
import { inRange, type MonthRange } from '../../utils/budget/period';
import { useUndoStore } from '../../store/useUndoStore';
import { cashMovement, entryKindOf } from '../../utils/budget/transactionKinds';
import { splitParts } from '../../utils/budget/splits';

interface TransactionListWidgetProps {
  range: MonthRange;
}

// Shared by row rendering and category sorting so a sort by "Category" orders
// by the same visible label the user reads, not by the opaque categoryId.
const resolveCategoryLabel = (tx: Transaction, categories: Record<string, Category>) =>
  tx.splits?.length
    ? `Split · ${tx.splits.length}`
    : tx.categoryId ? categories[tx.categoryId]?.name || 'Unknown' : 'Uncategorized';

export const TransactionListWidget: React.FC<TransactionListWidgetProps> = ({ range }) => {
  const transactions = useBudgetStore((state) => state.transactions);
  const categories = useBudgetStore((state) => state.categories);
  const categoryGroups = useBudgetStore((state) => state.categoryGroups);
  const clearAllTransactions = useBudgetStore((state) => state.clearAllTransactions);
  const setTransactionsCategory = useBudgetStore((state) => state.setTransactionsCategory);
  const deleteTransactions = useBudgetStore((state) => state.deleteTransactions);
  const addTransaction = useBudgetStore((state) => state.addTransaction);
  const offerUndo = useUndoStore((s) => s.offerUndo);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);

  type TxSortKey = 'date' | 'description' | 'category' | 'amount';
  const [txSort, setTxSort] = useState<{ key: TxSortKey; desc: boolean }>({ key: 'date', desc: true });
  const toggleTxSort = (key: TxSortKey) =>
    setTxSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key === 'date' || key === 'amount' }));

  const deleteWithUndo = (rows: Transaction[]) => {
    const label =
      rows.length === 1 ? `Deleted "${rows[0].description}"` : `Deleted ${rows.length} transactions`;
    deleteTransactions(rows.map((r) => r.id));
    offerUndo(label, () => {
      for (const tx of rows) addTransaction(tx);
    });
  };

  const needle = query.trim().toLowerCase();
  const txList = Object.values(transactions)
    .filter(tx => inRange(tx.date, range))
    .filter(tx => {
      if (selectedCategoryId === '') return true;
      if (selectedCategoryId === 'uncategorized') return splitParts(tx).some(part => !part.categoryId);
      return splitParts(tx).some(part => part.categoryId === selectedCategoryId);
    })
    .filter(tx => {
      if (!needle) return true;
      const categoryName = tx.categoryId ? categories[tx.categoryId]?.name ?? '' : '';
      const sliceNames = (tx.splits ?? [])
        .map((s) => (s.categoryId ? categories[s.categoryId]?.name ?? '' : ''))
        .join(' ');
      const haystack = [
        tx.description,
        categoryName,
        sliceNames,
        (tx.tags ?? []).join(' '),
        tx.note ?? '',
        entryKindOf(tx) === 'refund-payment' ? 'Refunds & Payments' : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // The user's chosen sort applies on top of the already-filtered list, and
  // never reorders the source data in the store.
  const sortedTxList = [...txList].sort((a, b) => {
    const dir = txSort.desc ? -1 : 1;
    if (txSort.key === 'amount') return (a.amount - b.amount) * dir;
    if (txSort.key === 'description') return a.description.localeCompare(b.description) * dir;
    if (txSort.key === 'category') return resolveCategoryLabel(a, categories).localeCompare(resolveCategoryLabel(b, categories)) * dir;
    return a.date.localeCompare(b.date) * dir;
  });

  // Selection is scoped to what is currently visible: narrowing the search must
  // not leave invisible rows armed for deletion.
  const visibleIds = txList.map((tx) => tx.id);
  const visibleIdSet = new Set(visibleIds);
  const selected = selectedIds.filter((id) => visibleIdSet.has(id));
  const selectedSet = new Set(selected);
  const allVisibleSelected = visibleIds.length > 0 && selected.length === visibleIds.length;
  const selectedTypes = new Set(selected.map(id => transactions[id].type));
  const mixedTypes = selectedTypes.size > 1;
  const bulkCategories = Object.values(categories).filter(c =>
    categoryGroups[c.groupId]?.kind === (selectedTypes.has('expense') ? 'expense' : 'income'),
  );
  const canApplyCategory = !mixedTypes && bulkCategories.some(c => c.id === bulkCategoryId);

  // Measured from the first rendered row rather than assumed: a row carrying
  // several tag chips wraps and exceeds the nominal height, which would
  // desynchronise the spacer rows from the real scroll offset. The constant is
  // only the pre-measurement fallback.
  const NOMINAL_ROW_HEIGHT = 48;
  const [rowHeight, setRowHeight] = useState(NOMINAL_ROW_HEIGHT);
  const firstRowRef = useRef<HTMLTableRowElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Intentionally no dependency array: this re-measures after every render so
  // it catches height changes from wrapped tag chips, and the `> 1` guard
  // below stops it looping once the measured value stabilizes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately unconditional; see comment above
  useEffect(() => {
    const h = firstRowRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - rowHeight) > 1) setRowHeight(h);
  });

  const windowed = computeWindow({
    scrollTop,
    viewportHeight,
    rowHeight,
    totalRows: txList.length,
    overscan: 8,
  });
  const visibleRows = sortedTxList.slice(windowed.startIndex, windowed.endIndex);

  // Measure the scroll container once it mounts (and whenever the layout
  // toggles between expanded/collapsed) so the first paint already windows
  // the rows instead of waiting for a scroll event to measure clientHeight.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.clientHeight !== viewportHeight) setViewportHeight(el.clientHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, txList.length > 0]);

  // The phone list is grouped by day and rendered in plain page flow, so it is
  // capped rather than windowed: the cap keeps a multi-year import from mounting
  // thousands of rows, and "Show all" lifts it on demand.
  const PHONE_ROW_CAP = 120;
  const [phoneShowAll, setPhoneShowAll] = useState(false);
  const phoneRows = phoneShowAll ? txList : txList.slice(0, PHONE_ROW_CAP);
  const dayGroups: { date: string; items: Transaction[] }[] = [];
  for (const tx of phoneRows) {
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else dayGroups.push({ date: tx.date, items: [tx] });
  }

  // Category chips are built from the period itself (not the search or the
  // current chip), so picking a chip never makes the other chips vanish.
  const phoneChips = (() => {
    const counts = new Map<string, number>();
    for (const tx of Object.values(transactions)) {
      if (!inRange(tx.date, range)) continue;
      for (const part of splitParts(tx)) {
        const id = part.categoryId || 'uncategorized';
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([id]) => ({ id, label: id === 'uncategorized' ? 'Uncategorized' : categories[id]?.name ?? 'Unknown' }));
  })();

  const formatDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const toggleRow = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const toggleAll = () => setSelectedIds(allVisibleSelected ? [] : visibleIds);

  const getTransactionDisplay = (tx: Transaction) => ({
    amountClass: cashMovement(tx) > 0 ? 'text-accent' : 'text-text-primary',
    amountText: `${cashMovement(tx) > 0 ? '+' : ''}${formatMoney(cashMovement(tx))}`,
    categoryLabel: resolveCategoryLabel(tx, categories),
    badge: entryKindOf(tx) === 'refund-payment' ? 'Refunds & Payments' : tx.shared
      ? `shared · ${tx.shared.sharedWith}`
      : tx.reimbursement
        ? `reimb · ${tx.reimbursement.from}`
        : null,
    tags: tx.tags ?? [],
    hasNote: !!tx.note,
  });

  const wrapperClass = isExpanded
    ? "fixed inset-4 z-50 bg-bg-secondary border border-border rounded-xl p-6 flex flex-col shadow-2xl animate-fade-in"
    : "mt-8 bg-bg-secondary border border-border rounded-xl p-6 flex flex-col min-h-[240px] desktop:min-h-[300px] max-md:mt-0 max-md:bg-transparent max-md:border-0 max-md:rounded-none max-md:p-0 max-md:min-h-0";

  return (
    <div className={wrapperClass}>
      <div className="hidden md:flex flex-wrap justify-between items-center gap-y-2 mb-4 border-b border-border pb-4">
        <h2 className="text-[18px] font-semibold text-text-primary">All Transactions</h2>
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="relative">
            <Search size={14} aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search transactions"
              placeholder="Search"
              className="h-[34px] w-40 sm:w-48 pl-7 pr-2 text-[13px] bg-bg-primary border border-border rounded-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent shadow-sm"
            />
          </div>
          <ThemedSelect
            value={selectedCategoryId}
            onChange={setSelectedCategoryId}
            className="text-[13px] shadow-sm"
            options={[
              { value: '', label: 'All Categories' },
              { value: 'uncategorized', label: 'Uncategorized' },
              ...Object.values(categories).map(c => ({ value: c.id, label: c.name })),
            ]}
          />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors bg-bg-primary rounded border border-border shadow-sm ml-2"
            title={isExpanded ? "Minimize" : "Expand to Full Screen"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {txList.length > 0 && (
            <button
              onClick={() => setConfirmClearOpen(true)}
              className="text-[13px] text-error hover:text-error/80 transition-colors border border-error/50 hover:bg-error/10 px-2 py-1.5 rounded-md flex items-center gap-1 shadow-sm"
            >
              <Trash2 size={14} aria-hidden="true" /> Delete all transactions
            </button>
          )}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="max-md:hidden flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg border border-accent/40 bg-accent/10">
          <span className="text-[13px] font-medium text-text-primary">{selected.length} selected</span>
          {mixedTypes ? <span className="text-[13px] text-text-secondary">Select only income or only expenses to change categories.</span> : <ThemedSelect
            ariaLabel="Category for selected"
            value={bulkCategoryId}
            onChange={setBulkCategoryId}
            className="text-[13px]"
            options={[
              { value: '', label: 'Choose a category' },
              ...bulkCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />}
          <button
            onClick={() => {
              if (!canApplyCategory) return;
              setTransactionsCategory(selected, bulkCategoryId);
              setSelectedIds([]);
              setBulkCategoryId('');
            }}
            disabled={!canApplyCategory}
            className="text-[13px] px-3 py-1.5 rounded-md bg-accent text-[var(--color-bg-primary)] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
          <button
            onClick={() => setConfirmBulkDeleteOpen(true)}
            className="text-[13px] px-3 py-1.5 rounded-md border border-error/40 text-error hover:bg-error/10"
          >
            Delete selected
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-[13px] px-2 py-1.5 rounded-md text-text-secondary hover:text-text-primary ml-auto"
          >
            Clear
          </button>
        </div>
      )}
      {txList.length === 0 ? (
        <div className="hidden md:flex flex-grow items-center justify-center">
          {needle || selectedCategoryId ? (
            <EmptyState
              icon={Search}
              message="No matching transactions"
              hint="Try a different search or clear the category filter."
            />
          ) : (
            <EmptyState icon={Receipt} message="No transactions yet" hint="Import a CSV or add one manually to see it here." />
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setScrollTop(el.scrollTop);
            if (el.clientHeight !== viewportHeight) setViewportHeight(el.clientHeight);
          }}
          className={`overflow-x-auto ${isExpanded ? 'flex-1 overflow-y-auto' : 'max-h-[560px] overflow-y-auto'}`}
        >
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">
                Transactions for the selected period, sortable by date, description, category or amount.
              </caption>
              <thead>
                <tr className="border-b border-border text-[12px] text-text-secondary">
                  <th scope="col" className="pb-2 font-medium w-8">
                    <Checkbox
                      ariaLabel="Select all transactions"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  {([
                    ['date', 'Date', ''],
                    ['description', 'Description', ''],
                    ['category', 'Category', ''],
                    ['amount', 'Amount', 'text-right'],
                  ] as const).map(([key, label, align]) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={txSort.key === key ? (txSort.desc ? 'descending' : 'ascending') : undefined}
                      className={`pb-2 font-medium ${align}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTxSort(key)}
                        aria-label={`Sort by ${label.toLowerCase()}`}
                        className="inline-flex items-center gap-1 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                      >
                        {label}
                        {txSort.key === key && <span aria-hidden="true">{txSort.desc ? '↓' : '↑'}</span>}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="pb-2 font-medium w-10">
                    <span className="sr-only">Row actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {windowed.padTop > 0 && (
                  <tr aria-hidden="true"><td colSpan={6} style={{ height: windowed.padTop, padding: 0 }} /></tr>
                )}
                {visibleRows.map((tx, i) => {
                  const { amountClass, amountText, categoryLabel, badge, tags, hasNote } = getTransactionDisplay(tx);
                  return (
                  <tr
                    key={tx.id}
                    ref={i === 0 ? firstRowRef : undefined}
                    className="border-b border-border/50 hover:bg-bg-primary/50 transition-colors group cursor-pointer"
                    onClick={() => setEditingTransaction(tx)}
                  >
                    <td className="py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        ariaLabel="Select transaction"
                        checked={selectedSet.has(tx.id)}
                        onChange={() => toggleRow(tx.id)}
                      />
                    </td>
                    <td className="py-3 text-[14px] whitespace-nowrap">{tx.date}</td>
                    <td className="py-3 text-[14px]">
                      <button
                        type="button"
                        aria-label={`Edit ${tx.description}`}
                        className="text-left bg-transparent border-0 p-0 m-0 font-inherit text-inherit cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTransaction(tx);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          // Space would otherwise scroll the list out from under the row.
                          e.preventDefault()
                          setEditingTransaction(tx)
                        }}
                      >
                        {tx.description}
                      </button>
                    </td>
                    <td className="py-3 text-[14px]">
                      <span className="px-2 py-1 bg-bg-primary border border-border rounded-md text-[12px]">
                        {categoryLabel}
                      </span>
                      {badge && (
                        <span className="ml-1 px-2 py-1 bg-accent/10 text-accent rounded-md text-[12px]">{badge}</span>
                      )}
                      {tags.map((tag) => (
                        <span key={tag} className="ml-1 px-2 py-1 bg-bg-primary border border-border rounded-md text-[12px] text-text-secondary">
                          #{tag}
                        </span>
                      ))}
                      {hasNote && (
                        <span className="ml-1 text-[12px] text-text-secondary" title="Has a note" aria-label="Has a note">
                          ✎
                        </span>
                      )}
                    </td>
                    <td className={`py-3 text-[14px] font-medium text-right ${amountClass}`}>
                      {amountText}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteWithUndo([tx]);
                        }}
                        aria-label="Delete transaction"
                        className="p-2 text-text-secondary hover:text-error reveal-on-hover transition-opacity rounded-md hover:bg-bg-primary"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
                {windowed.padBottom > 0 && (
                  <tr aria-hidden="true"><td colSpan={6} style={{ height: windowed.padBottom, padding: 0 }} /></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div data-testid="transactions-cards" className="md:hidden">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Find a transaction"
          placeholder="Search transactions"
          className="h-10 w-full px-3 text-[14px] rounded-lg bg-bg-secondary border border-border text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
        />
        {phoneChips.length > 0 && (
          <div role="group" aria-label="Filter by category" className="flex gap-1.5 overflow-x-auto mt-3 pb-3 -mx-1 px-1">
            {[{ id: '', label: 'All' }, ...phoneChips].map((chip) => {
              const on = selectedCategoryId === chip.id;
              return (
                <button
                  key={chip.id || 'all'}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedCategoryId(chip.id)}
                  className={`shrink-0 px-3 min-h-[44px] rounded-full border text-[12px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    on ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary bg-bg-primary'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}
        {txList.length === 0 ? (
          <div className="py-10">
            {needle || selectedCategoryId ? (
              <EmptyState icon={Search} message="No matching transactions" hint="Try a different search or clear the category filter." />
            ) : (
              <EmptyState icon={Receipt} message="No transactions yet" hint="Import a CSV or add one manually to see it here." />
            )}
          </div>
        ) : (
          <div id="transactions-phone-list" className="-mx-1">
            {dayGroups.map((group) => (
              <section key={group.date} aria-label={formatDay(group.date)}>
                <div className="flex justify-between px-3 py-1.5 text-[11.5px] uppercase tracking-wide text-text-secondary bg-bg-secondary border-y border-border">
                  <span>{formatDay(group.date)}</span>
                  <span className="tabular-nums">{formatMoney(group.items.reduce((sum, tx) => sum + cashMovement(tx), 0))}</span>
                </div>
                {group.items.map((tx) => {
                  const { amountClass, amountText, categoryLabel, badge, tags, hasNote } = getTransactionDisplay(tx);
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      data-testid={`transaction-card-${tx.id}`}
                      aria-label={`Edit ${tx.description}`}
                      onClick={() => setEditingTransaction(tx)}
                      className="w-full min-h-[56px] flex items-center gap-3 px-3 py-3 text-left bg-transparent border-0 border-b border-border font-inherit cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[14px] text-text-primary">{tx.description}</span>
                        <span className="block truncate text-[12px] text-text-secondary">
                          {categoryLabel}
                          {badge && <> · <span className="text-accent">{badge}</span></>}
                          {tags.map((tag) => ` · #${tag}`)}
                          {hasNote && <span aria-label="Has a note"> ✎</span>}
                        </span>
                      </span>
                      <span className={`tabular-nums font-semibold text-[14px] whitespace-nowrap ${amountClass}`}>{amountText}</span>
                    </button>
                  );
                })}
              </section>
            ))}
            {txList.length > PHONE_ROW_CAP && (
              <ShowMoreButton
                total={txList.length}
                noun="transactions"
                expanded={phoneShowAll}
                onToggle={() => setPhoneShowAll((v) => !v)}
                controls="transactions-phone-list"
              />
            )}
          </div>
        )}
      </div>

      <TransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        initialTransaction={editingTransaction}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear all transactions?"
        message={`Every transaction (${Object.keys(transactions).length}) will be deleted, including any hidden by the current search or filter. You can undo this straight afterwards.`}
        confirmLabel="Delete all"
        tone="danger"
        onConfirm={() => {
          const all = Object.values(transactions);
          clearAllTransactions();
          offerUndo(`Cleared ${all.length} transaction${all.length === 1 ? '' : 's'}`, () => {
            for (const tx of all) addTransaction(tx);
          });
          setConfirmClearOpen(false);
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />

      <ConfirmDialog
        open={confirmBulkDeleteOpen}
        title={`Delete ${selected.length} transaction${selected.length === 1 ? '' : 's'}?`}
        message="The selected transactions will be removed. You can undo this straight afterwards."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          deleteWithUndo(txList.filter((tx) => selectedSet.has(tx.id)));
          setSelectedIds([]);
          setConfirmBulkDeleteOpen(false);
        }}
        onCancel={() => setConfirmBulkDeleteOpen(false)}
      />
    </div>
  );
};
