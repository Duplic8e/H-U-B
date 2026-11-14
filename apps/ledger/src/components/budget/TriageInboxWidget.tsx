import React, { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { WidgetWrapper } from '../dashboard/WidgetWrapper';
import { useTriageStore } from '../../store/useTriageStore';
import { useBudgetStore } from '../../store/useBudgetStore';
import { useUndoStore } from '../../store/useUndoStore';
import { ThemedSelect } from '../ui/ThemedSelect';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { formatMoney } from '../planner/format';
import { captureTriageUndo } from '../../utils/budget/triageUndo';
import { ExclusionRuleSheet } from './ExclusionRuleSheet';

import { cashMovement, entryKindOf, hasValidOffsetCategory, hasValidPendingCategory } from '../../utils/budget/transactionKinds';

const reviewEntryId = (id: string) => `import-review-${id}`;

export const TriageInboxWidget: React.FC = () => {
  const pendingTransactions = useTriageStore((state) => state.pendingTransactions);
  const setPendingReceiptTreatment = useTriageStore((state) => state.setPendingReceiptTreatment);
  const updatePending = useTriageStore((state) => state.updatePending);
  const approveTransaction = useTriageStore((state) => state.approveTransaction);
  const approveAll = useTriageStore((state) => state.approveAll);
  const rejectTransaction = useTriageStore((state) => state.rejectTransaction);
  const resolveDuplicate = useTriageStore((state) => state.resolveDuplicate);
  const importRecords = useTriageStore((state) => state.importRecords);
  const importSources = useTriageStore((state) => state.importSources);
  const transactions = useBudgetStore((state) => state.transactions);
  const rejectDuplicates = useTriageStore((state) => state.rejectDuplicates);
  const rejectCardPayments = useTriageStore((state) => state.rejectCardPayments);
  const clearAll = useTriageStore((state) => state.clearAll);
  const deleteTransactions = useBudgetStore((state) => state.deleteTransactions);
  const offerUndo = useUndoStore((state) => state.offerUndo);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [seedRecordId, setSeedRecordId] = useState<string>();

  const categories = useBudgetStore((state) => state.categories);
  const categoryGroups = useBudgetStore((state) => state.categoryGroups);
  const refundsAndPaymentsEnabled = useBudgetStore((state) => state.refundsAndPaymentsEnabled);

  const txList = Object.values(pendingTransactions).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const categoryList = Object.values(categories);

  if (txList.length === 0) return null;

  const duplicates = txList.filter((tx) => tx.duplicate);
  const cardPayments = txList.filter((tx) => tx.flag === 'card-payment');
  // Recomputed from the list rather than subtracted, because one row can be both
  // a duplicate and flagged, and subtracting both counts would double-count it.
  const acceptableRows = txList.filter((tx) => !tx.duplicate && !tx.flag && !tx.exclusionMatches?.length && hasValidPendingCategory(tx, categories, categoryGroups));
  const acceptableCount = acceptableRows.length;
  const held = txList.filter(tx => tx.exclusionMatches?.length && !tx.duplicate && tx.importRecordId && importSources[importRecords[tx.importRecordId]?.sourceId]);
  const captureRows = (rows: typeof txList) => captureTriageUndo({ pendingIds: rows.map(tx => tx.id), recordIds: rows.flatMap(tx => tx.importRecordId ? [tx.importRecordId] : []) });
  const offerApprovalUndo = (offer: ReturnType<typeof captureTriageUndo>, ids: string[]) => {
    offer(`Added ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
    const restore = useUndoStore.getState().pending!.undo;
    offerUndo(`Added ${ids.length} transaction${ids.length === 1 ? '' : 's'}`, () => { deleteTransactions(ids); restore(); });
  };
  const excludeWithUndo = (rows: typeof txList) => {
    const offer = captureRows(rows);
    const ids = useTriageStore.getState().excludeExclusionMatches(rows.map(tx => tx.id));
    if (ids.length) offer(`Excluded ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
  };
  const includeWithUndo = (tx: typeof txList[number]) => {
    const offer = captureRows([tx]);
    useTriageStore.getState().includeExclusionMatch(tx.id);
    offer('Included 1 transaction for review');
  };

  const handleAcceptAll = () => {
    const rows = acceptableRows;
    const offer = captureRows(rows);
    const ids = approveAll();
    if (ids.length) offerApprovalUndo(offer, ids);
  };

  const approveWithUndo = (tx: typeof txList[number]) => {
    if (tx.exclusionMatches?.length || !hasValidPendingCategory(tx, categories, categoryGroups)) return;
    const offer = captureRows([tx]);
    approveTransaction(tx.id);
    offerApprovalUndo(offer, [tx.id]);
  };
  const ignoreWithUndo = (tx: typeof txList[number], duplicate = false) => {
    const offer = captureRows([tx]);
    if (duplicate) resolveDuplicate(tx.id); else rejectTransaction(tx.id);
    offer(duplicate ? 'Matched 1 duplicate' : 'Ignored 1 charge');
  };

  return (
    <WidgetWrapper title={`Triage Inbox (${txList.length})`}>
      <div className="flex flex-wrap justify-end gap-2 mt-2">
        <button
          onClick={() => setConfirmClearOpen(true)}
          className="text-[13px] font-medium text-error hover:opacity-80 transition-opacity flex items-center gap-1 bg-error/10 min-h-11 px-3 rounded-md"
        >
          <Trash2 size={14} aria-hidden="true" /> Discard All
        </button>
        {duplicates.length > 0 && (
          <button
            onClick={() => {
              const offer = captureRows(duplicates);
              rejectDuplicates();
              offer(`Matched ${duplicates.length} duplicates`);
            }}
            className="text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors border border-border min-h-11 px-3 rounded-md"
          >
            Reject {duplicates.length} duplicate{duplicates.length === 1 ? '' : 's'}
          </button>
        )}
        {cardPayments.length > 0 && (
          <button
            onClick={() => {
              const offer = captureRows(cardPayments);
              rejectCardPayments();
              offer(`Ignored ${cardPayments.length} card payments`);
            }}
            className="text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors border border-border min-h-11 px-3 rounded-md"
          >
            Reject {cardPayments.length} Card Payment{cardPayments.length === 1 ? '' : 's'}
          </button>
        )}
        {held.length > 0 && <button onClick={() => excludeWithUndo(held)} className="min-h-11 px-3 rounded-md border border-border text-text-secondary">Exclude matches ({held.length})</button>}
        <button
          onClick={handleAcceptAll}
          disabled={!acceptableCount}
          className="text-[13px] font-medium text-[var(--color-accent)] hover:opacity-80 transition-opacity flex items-center gap-1 bg-[var(--color-accent)]/10 min-h-11 px-3 rounded-md"
        >
          <Check size={14} /> Accept All ({acceptableCount})
        </button>
      </div>
      <div className="flex flex-col gap-3 mt-3 max-h-[280px] desktop:max-h-[400px] overflow-y-auto pr-2">
        {txList.map(tx => {
          const kind = entryKindOf(tx);
          const offsetReady = hasValidOffsetCategory(tx, categories, categoryGroups);
          const categoryReady = hasValidPendingCategory(tx, categories, categoryGroups);
          const matchingCategories = categoryList.filter(cat => categoryGroups[cat.groupId]?.kind === tx.type);
          const selectedCategory = matchingCategories.some(cat => cat.id === tx.categoryId) ? tx.categoryId : '';
          const canCreateExclusion = !!tx.importRecordId && !!importSources[importRecords[tx.importRecordId]?.sourceId];
          const existing = tx.duplicateRecordId ? importRecords[tx.duplicateRecordId]?.original :
            tx.duplicateTransactionId ? transactions[tx.duplicateTransactionId] ?? pendingTransactions[tx.duplicateTransactionId] : undefined;
          return (
          <div key={tx.id} id={reviewEntryId(tx.id)} tabIndex={-1} className="min-w-0 flex flex-col p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] desktop:grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-3 gap-y-2">
              <div className="min-w-0 break-words">
                <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{tx.description}</p>
                {tx.importSourceId && <p className="text-[12px] text-text-secondary">{importSources[tx.importSourceId]?.name}</p>}
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  {tx.date}
                  {tx.duplicate && (
                    <span className="ml-2 px-2 py-0.5 rounded-md text-meta bg-error/10 text-error">
                      {tx.duplicate === 'exact' ? 'already imported' : 'possible duplicate'}
                    </span>
                  )}
                  {tx.flag === 'card-payment' && (
                    <span className="ml-2 px-2 py-0.5 rounded-md text-meta bg-error/10 text-error">
                      card payment, not income
                    </span>
                  )}
                </p>
              </div>
              <button
                disabled={!canCreateExclusion}
                onClick={() => setSeedRecordId(tx.importRecordId)}
                className="order-3 col-span-2 justify-self-start min-h-11 -ml-3 px-3 rounded-md text-[13px] text-accent hover:bg-accent/10 disabled:opacity-50 desktop:order-none desktop:col-span-1 desktop:ml-0 desktop:border desktop:border-border desktop:whitespace-nowrap"
              >Exclude similar transactions</button>
              <span className={`order-2 desktop:order-none min-h-11 flex items-center shrink-0 text-[14px] font-bold ${tx.type === 'income' ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                {cashMovement(tx) > 0 ? `+${formatMoney(cashMovement(tx))}` : formatMoney(cashMovement(tx))}
              </span>
            </div>
            {existing && <p className="text-[13px] text-text-secondary break-words">
              Existing: {existing.description} · {existing.date} · ${existing.amount.toFixed(2)}
            </p>}
            {tx.exclusionMatches?.length ? <div className="flex flex-col gap-2 min-w-0">
              <p className="text-[13px] text-text-secondary break-words">Matches exclusion rule: {tx.exclusionMatches.map(match => match.name).join(', ')}</p>
              <div className="flex flex-wrap gap-2">
                {!tx.duplicate && <button className="min-h-11 px-3 rounded-md border border-border text-text-secondary" onClick={() => excludeWithUndo([tx])}>Exclude</button>}
                <button className="min-h-11 px-3 rounded-md border border-border text-accent" onClick={() => includeWithUndo(tx)}>Include this transaction</button>
              </div>
            </div> : null}
            {!canCreateExclusion && <p className="text-[12px] text-text-secondary">Source information unavailable</p>}
            {cashMovement(tx) > 0 && <div className="flex flex-col gap-1 min-w-0">
              <p className="text-[12px] text-text-secondary">Changing treatment clears the category. Review your category before accepting.</p>
              {kind === 'refund-payment' && <p className="text-[12px] text-text-secondary">Reduces spending in one expense category. You can split this payment after acceptance in the transaction editor.</p>}
              {kind === 'refund-payment' && !refundsAndPaymentsEnabled && <p className="text-[12px] text-text-secondary">Refunds & Payments is off for new transactions. This saved payment still counts.</p>}
            </div>}
            {!categoryReady && offsetReady && <p className="text-[12px] text-text-secondary">Review this category before accepting. Choose a valid category or Uncategorized.</p>}
            {!offsetReady && <p className="text-[12px] text-text-secondary">Choose an expense category before accepting this payment</p>}
            <div className="flex flex-col desktop:flex-row gap-2 min-w-0 mt-1">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {cashMovement(tx) > 0 && <div className="flex-1 min-w-0 desktop:flex-none desktop:w-[210px]">
                  <ThemedSelect value={kind} ariaLabel={`Treatment for ${tx.description}`}
                    className="min-w-0 !min-h-11 !text-[13px]"
                    onChange={value => {
                      if (value !== kind) setPendingReceiptTreatment(tx.id, value as 'income' | 'refund-payment');
                    }}
                    options={[
                      { value: 'income', label: 'Income' },
                      ...(refundsAndPaymentsEnabled || kind === 'refund-payment' ? [{ value: 'refund-payment', label: 'Refunds & Payments' }] : []),
                    ]} />
                </div>}
                <div className="flex-1 min-w-0">
                  <ThemedSelect
                    value={selectedCategory || ''}
                    onChange={(v) => updatePending(tx.id, { categoryId: v })}
                    className="min-w-0 !min-h-11 !text-[13px]"
                    ariaLabel={`Category for ${tx.description}`}
                    options={[
                      { value: '', label: 'Uncategorized' },
                      ...matchingCategories.map(cat => ({ value: cat.id, label: cat.name })),
                    ]}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end shrink-0">
                {!tx.duplicate && <button
                  onClick={() => approveWithUndo(tx)}
                  disabled={!!tx.exclusionMatches?.length || !categoryReady}
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                  title="Approve"
                  aria-label={`Approve ${tx.description}`}
                >
                  <Check size={16} />
                </button>}
                {!tx.duplicate && <button
                  onClick={() => ignoreWithUndo(tx)}
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded bg-error/10 text-error hover:bg-error/20 transition-colors"
                  title="Reject/Delete"
                  aria-label={`Ignore ${tx.description}`}
                >
                  <X size={16} />
                </button>}
              </div>
            </div>
            {tx.duplicate && <div className="flex flex-wrap gap-2 text-[13px]">
              <button onClick={() => ignoreWithUndo(tx, true)} className="min-h-11 px-3 rounded border border-border text-accent">Same charge</button>
              <button disabled={!!tx.exclusionMatches?.length || !categoryReady} onClick={() => approveWithUndo(tx)} className="min-h-11 px-3 rounded border border-border text-accent disabled:opacity-50">Keep both</button>
              <button onClick={() => ignoreWithUndo(tx)} className="min-h-11 px-3 rounded border border-border text-text-secondary">Ignore this charge</button>
            </div>}
          </div>
        ); })}
      </div>
      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear triage inbox?"
        message={`Discard ${txList.length} pending transaction${txList.length === 1 ? '' : 's'}? Nothing will be added to your budget. You can undo this straight afterwards.`}
        confirmLabel="Discard All"
        tone="danger"
        onConfirm={() => {
          const cleared = txList;
          const offer = captureTriageUndo({ discard: true });
          clearAll();
          offer(`Cleared ${cleared.length} pending transaction${cleared.length === 1 ? '' : 's'}`);
          setConfirmClearOpen(false);
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
      <ExclusionRuleSheet open={!!seedRecordId} seedRecordId={seedRecordId} onClose={() => setSeedRecordId(undefined)} />
    </WidgetWrapper>
  );
};

