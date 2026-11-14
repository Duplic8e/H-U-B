import React, { useState } from 'react';
import { Check, MoreHorizontal } from 'lucide-react';
import { useTriageStore } from '../../store/useTriageStore';
import { useBudgetStore } from '../../store/useBudgetStore';
import { useUndoStore } from '../../store/useUndoStore';
import { ThemedSelect } from '../ui/ThemedSelect';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Sheet } from '../ui/Sheet';
import { formatMoney } from '../planner/format';
import { captureTriageUndo } from '../../utils/budget/triageUndo';
import { ExclusionRuleSheet } from './ExclusionRuleSheet';
import { cashMovement, entryKindOf, hasValidOffsetCategory, hasValidPendingCategory } from '../../utils/budget/transactionKinds';

type Tx = ReturnType<typeof useTriageStore.getState>['pendingTransactions'][string];

function useTriageReview() {
  const s = useTriageStore();
  const categories = useBudgetStore((x) => x.categories);
  const categoryGroups = useBudgetStore((x) => x.categoryGroups);
  const refundsOn = useBudgetStore((x) => x.refundsAndPaymentsEnabled);
  const transactions = useBudgetStore((x) => x.transactions);
  const deleteTransactions = useBudgetStore((x) => x.deleteTransactions);
  const offerUndo = useUndoStore((x) => x.offerUndo);

  const list = Object.values(s.pendingTransactions).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const catList = Object.values(categories);
  const ready = (tx: Tx) => !tx.duplicate && !tx.flag && !tx.exclusionMatches?.length && hasValidPendingCategory(tx, categories, categoryGroups);
  const canApprove = (tx: Tx) => !tx.exclusionMatches?.length && hasValidPendingCategory(tx, categories, categoryGroups);
  const capture = (rows: Tx[]) => captureTriageUndo({ pendingIds: rows.map((t) => t.id), recordIds: rows.flatMap((t) => (t.importRecordId ? [t.importRecordId] : [])) });
  const undoAdded = (offer: ReturnType<typeof captureTriageUndo>, ids: string[]) => {
    const msg = `Added ${ids.length} transaction${ids.length === 1 ? '' : 's'}`;
    offer(msg);
    const restore = useUndoStore.getState().pending!.undo;
    offerUndo(msg, () => { deleteTransactions(ids); restore(); });
  };
  const approve = (tx: Tx) => {
    if (tx.exclusionMatches?.length || !hasValidPendingCategory(tx, categories, categoryGroups)) return;
    const offer = capture([tx]);
    s.approveTransaction(tx.id);
    undoAdded(offer, [tx.id]);
  };
  const approveMany = (rows: Tx[]) => {
    const ok = rows.filter(ready);
    if (!ok.length) return;
    const offer = capture(ok);
    const ids = ok.map((t) => { s.approveTransaction(t.id); return t.id; });
    undoAdded(offer, ids);
  };
  const acceptAll = () => {
    const offer = capture(list.filter(ready));
    const ids = s.approveAll();
    if (ids.length) undoAdded(offer, ids);
  };
  const ignore = (tx: Tx, dup = false) => {
    const offer = capture([tx]);
    if (dup) s.resolveDuplicate(tx.id); else s.rejectTransaction(tx.id);
    offer(dup ? 'Matched 1 duplicate' : 'Ignored 1 charge');
  };
  const ignoreMany = (rows: Tx[]) => {
    const offer = capture(rows);
    rows.forEach((t) => s.rejectTransaction(t.id));
    offer(`Ignored ${rows.length} charge${rows.length === 1 ? '' : 's'}`);
  };
  const existingOf = (tx: Tx) => (tx.duplicateRecordId ? s.importRecords[tx.duplicateRecordId]?.original
    : tx.duplicateTransactionId ? transactions[tx.duplicateTransactionId] ?? s.pendingTransactions[tx.duplicateTransactionId] : undefined);
  const canExclude = (tx: Tx | undefined) => !!tx?.importRecordId && !!s.importSources[s.importRecords[tx.importRecordId]?.sourceId];
  const matching = (tx: Tx) => catList.filter((c) => categoryGroups[c.groupId]?.kind === tx.type);
  const selected = (tx: Tx) => (matching(tx).some((c) => c.id === tx.categoryId) ? tx.categoryId ?? '' : '');
  const catName = (tx: Tx) => categories[selected(tx)]?.name;
  const note = (tx: Tx): string | null => {
    const ex = existingOf(tx);
    if (tx.duplicate) return `${tx.duplicate === 'exact' ? 'Already imported' : 'Possible duplicate'}${ex ? `: ${ex.description} · ${ex.date}` : ''}`;
    if (tx.flag === 'card-payment') return 'Card payment, not income';
    if (tx.exclusionMatches?.length) return `Matches rule: ${tx.exclusionMatches.map((m) => m.name).join(', ')}`;
    if (!hasValidOffsetCategory(tx, categories, categoryGroups)) return 'Choose an expense category first';
    if (!hasValidPendingCategory(tx, categories, categoryGroups)) return 'Pick a category to accept';
    return null;
  };
  const money = (tx: Tx) => (cashMovement(tx) > 0 ? `+${formatMoney(cashMovement(tx))}` : formatMoney(cashMovement(tx)));
  return { s, list, ready, canApprove, approve, approveMany, acceptAll, ignore, ignoreMany, canExclude, matching, selected, catName, note, money, refundsOn, capture };
}
type T = ReturnType<typeof useTriageReview>;

const card = 'rounded-xl border border-border bg-bg-secondary';
const accentBtn = 'bg-accent/10 text-accent';

const Badge: React.FC<{ tx: Tx }> = ({ tx }) => (
  <>
    {tx.duplicate && <span className="px-1.5 py-0.5 rounded-md text-meta bg-error/10 text-error">{tx.duplicate === 'exact' ? 'already imported' : 'possible duplicate'}</span>}
    {tx.flag === 'card-payment' && <span className="px-1.5 py-0.5 rounded-md text-meta bg-error/10 text-error">card payment</span>}
    {!!tx.exclusionMatches?.length && <span className="px-1.5 py-0.5 rounded-md text-meta bg-accent/10 text-accent">rule match</span>}
  </>
);

const Amount: React.FC<{ t: T; tx: Tx }> = ({ t, tx }) => (
  <span className={`shrink-0 text-[14px] font-semibold tabular-nums ${tx.type === 'income' ? 'text-accent' : 'text-text-primary'}`}>{t.money(tx)}</span>
);

const CategoryPick: React.FC<{ t: T; tx: Tx }> = ({ t, tx }) => (
  <ThemedSelect value={t.selected(tx)} ariaLabel={`Category for ${tx.description}`} className="min-w-0 !min-h-11 !text-[13px]"
    onChange={(v) => t.s.updatePending(tx.id, { categoryId: v })}
    options={[{ value: '', label: 'Uncategorized' }, ...t.matching(tx).map((c) => ({ value: c.id, label: c.name }))]} />
);

const TreatmentPick: React.FC<{ t: T; tx: Tx }> = ({ t, tx }) => {
  const kind = entryKindOf(tx);
  return (
    <ThemedSelect value={kind} ariaLabel={`Treatment for ${tx.description}`} className="min-w-0 !min-h-11 !text-[13px]"
      onChange={(v) => { if (v !== kind) t.s.setPendingReceiptTreatment(tx.id, v as 'income' | 'refund-payment'); }}
      options={[{ value: 'income', label: 'Income' }, ...(t.refundsOn || kind === 'refund-payment' ? [{ value: 'refund-payment', label: 'Refunds & Payments' }] : [])]} />
  );
};

const DuplicateActions: React.FC<{ t: T; tx: Tx }> = ({ t, tx }) => (
  <div className="flex flex-wrap gap-2 text-[13px]">
    <button onClick={() => t.ignore(tx, true)} className="min-h-11 px-3 rounded-lg border border-border text-accent">Same charge</button>
    <button onClick={() => t.approve(tx)} disabled={!t.canApprove(tx)} className="min-h-11 px-3 rounded-lg border border-border text-accent disabled:opacity-50">Keep both</button>
    <button onClick={() => t.ignore(tx)} className="min-h-11 px-3 rounded-lg border border-border text-text-secondary">Ignore this charge</button>
  </div>
);

// Accept All, the Select toggle (passed as `middle`) and an overflow sheet for the rarer actions.
const Bulk: React.FC<{ t: T; middle?: React.ReactNode }> = ({ t, middle }) => {
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const dups = t.list.filter((x) => x.duplicate);
  const cards = t.list.filter((x) => x.flag === 'card-payment');
  const held = t.list.filter((x) => x.exclusionMatches?.length && !x.duplicate);
  const acceptable = t.list.filter(t.ready).length;
  const row = 'min-h-12 w-full text-left px-1 text-[14px] flex items-center';
  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={t.acceptAll} disabled={!acceptable} className={`flex-1 min-h-12 rounded-xl text-[14px] font-semibold ${accentBtn} border border-accent/35 disabled:opacity-50`}>
          Accept All ({acceptable})
        </button>
        {middle}
        <button aria-label="More triage actions" onClick={() => setMore(true)} className="h-12 w-12 rounded-xl border border-border flex items-center justify-center text-text-secondary"><MoreHorizontal size={18} /></button>
      </div>
      <Sheet open={more} onClose={() => setMore(false)} ariaLabel="Triage actions">
        <div className="flex flex-col divide-y divide-border">
          {dups.length > 0 && <button className={row} onClick={() => { const o = t.capture(dups); t.s.rejectDuplicates(); o(`Matched ${dups.length} duplicates`); setMore(false); }}>Reject {dups.length} duplicate{dups.length === 1 ? '' : 's'}</button>}
          {cards.length > 0 && <button className={row} onClick={() => { const o = t.capture(cards); t.s.rejectCardPayments(); o(`Ignored ${cards.length} card payments`); setMore(false); }}>Reject {cards.length} Card Payment{cards.length === 1 ? '' : 's'}</button>}
          {held.length > 0 && <button className={row} onClick={() => { const o = t.capture(held); const ids = t.s.excludeExclusionMatches(held.map((x) => x.id)); if (ids.length) o(`Excluded ${ids.length} transactions`); setMore(false); }}>Exclude matches ({held.length})</button>}
          <button className={`${row} text-error`} onClick={() => { setMore(false); setConfirm(true); }}>Discard All</button>
        </div>
      </Sheet>
      <ConfirmDialog open={confirm} title="Clear triage inbox?" tone="danger" confirmLabel="Discard All"
        message={`Discard ${t.list.length} pending transaction${t.list.length === 1 ? '' : 's'}? Nothing will be added to your budget. You can undo this straight afterwards.`}
        onConfirm={() => { const n = t.list.length; const o = captureTriageUndo({ discard: true }); t.s.clearAll(); o(`Cleared ${n} pending transaction${n === 1 ? '' : 's'}`); setConfirm(false); }}
        onCancel={() => setConfirm(false)} />
    </>
  );
};

const ShowMore: React.FC<{ shown: number; total: number; onMore: () => void }> = ({ shown, total, onMore }) =>
  shown < total ? <button onClick={onMore} className="min-h-12 w-full text-[13px] font-medium text-accent border-t border-border">Show {Math.min(20, total - shown)} more ({total - shown} left)</button> : null;

export const TriageInboxMobile: React.FC = () => {
  const t = useTriageReview();
  const [shown, setShown] = useState(20);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [seedRecordId, setSeedRecordId] = useState<string>();
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clear = () => setSel(new Set());
  const exitSelect = () => { setSelecting(false); clear(); };

  if (t.list.length === 0) return null;

  // A row can leave the inbox while selected (approved from the sheet, say), so
  // the selection is always read back through the live list.
  const chosen = t.list.filter((x) => sel.has(x.id));
  const readyIds = t.list.filter(t.ready).map((x) => x.id);
  const kinds = new Set(chosen.map((x) => x.type));
  const catOptions = kinds.size === 1 ? t.matching(chosen[0]) : [];
  const cur = openId ? t.s.pendingTransactions[openId] : undefined;
  return (
    <div data-testid="triage-inbox-mobile" className={`flex flex-col gap-3 ${chosen.length > 0 ? 'pb-28' : ''}`}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[18px] font-semibold font-display">Triage Inbox</h2>
        <span className="text-[13px] text-text-secondary tabular-nums">{t.list.length} to Review</span>
      </div>
      {selecting ? (
        <div className="flex items-center gap-2">
          <button onClick={() => setSel(new Set(readyIds))} className={`flex-1 min-h-12 rounded-xl text-[14px] font-semibold ${accentBtn} border border-accent/35`}>Select All Ready ({readyIds.length})</button>
          <button onClick={exitSelect} className="min-h-12 px-4 rounded-xl border border-border text-[14px] text-text-secondary">Done</button>
        </div>
      ) : (
        <Bulk t={t} middle={<button onClick={() => setSelecting(true)} className="h-12 px-4 rounded-xl border border-border text-[14px] font-semibold text-accent">Select</button>} />
      )}
      <div className={`${card} divide-y divide-border overflow-hidden`}>
        {t.list.slice(0, shown).map((tx) => {
          const on = sel.has(tx.id);
          const warn = !t.ready(tx);
          return (
            <div key={tx.id} id={`import-review-${tx.id}`} tabIndex={-1} className={`flex items-center ${on ? 'bg-accent/10' : ''}`}>
              {selecting && (
                <button role="checkbox" aria-checked={on} aria-label={`Select ${tx.description}`} onClick={() => toggle(tx.id)} className="h-14 w-12 shrink-0 flex items-center justify-center">
                  <span className={`h-6 w-6 rounded-full border flex items-center justify-center ${on ? 'bg-accent border-accent text-bg-primary' : 'border-border'}`}>{on && <Check size={14} />}</span>
                </button>
              )}
              <button onClick={() => (selecting ? toggle(tx.id) : setOpenId(tx.id))} className={`flex-1 min-w-0 min-h-[56px] py-2 flex items-center gap-3 text-left ${selecting ? '' : 'pl-3'}`}>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] truncate">{tx.description}</span>
                  <span className={`block text-[12px] truncate ${warn ? 'text-error' : 'text-text-secondary'}`}>{tx.date} · {t.note(tx) ?? t.catName(tx) ?? 'Uncategorized'}</span>
                </span>
                <Amount t={t} tx={tx} />
              </button>
              <div className="px-1 w-[52px]">
                {!selecting && !tx.duplicate && (
                  <button aria-label={`Approve ${tx.description}`} disabled={warn} onClick={() => t.approve(tx)} className={`h-11 w-11 flex items-center justify-center rounded-lg ${accentBtn} disabled:opacity-40`}><Check size={16} /></button>
                )}
              </div>
            </div>
          );
        })}
        <ShowMore shown={shown} total={t.list.length} onMore={() => setShown(shown + 20)} />
      </div>
      {chosen.length > 0 && (
        <div className="fixed inset-x-3 bottom-[76px] z-30 rounded-2xl border border-border bg-bg-secondary shadow-lg p-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[13px] font-medium flex-1">{chosen.length} Selected</span>
            {catOptions.length > 0 && (
              <div className="w-[170px]">
                <ThemedSelect value="" ariaLabel="Set Category for selected" className="min-w-0 !min-h-11 !text-[13px]"
                  onChange={(v) => { if (v) chosen.forEach((x) => t.s.updatePending(x.id, { categoryId: v })); }}
                  options={[{ value: '', label: 'Set Category' }, ...catOptions.map((c) => ({ value: c.id, label: c.name }))]} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { t.ignoreMany(chosen); clear(); }} className="flex-1 min-h-12 rounded-xl bg-error/10 text-error text-[14px] font-semibold">Ignore</button>
            <button onClick={() => { t.approveMany(chosen); clear(); }} className={`flex-[2] min-h-12 rounded-xl ${accentBtn} border border-accent/35 text-[14px] font-semibold`}>Accept {chosen.filter(t.ready).length}</button>
          </div>
          <button disabled={!t.canExclude(chosen[0])} onClick={() => setSeedRecordId(chosen[0].importRecordId)} className="min-h-11 text-[13px] text-accent disabled:opacity-50">
            Exclude Similar Transactions
          </button>
        </div>
      )}
      <Sheet open={!!cur} onClose={() => setOpenId(null)} ariaLabel="Review transaction">
        {cur && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3"><p className="text-[16px] font-medium break-words min-w-0">{cur.description}</p><Amount t={t} tx={cur} /></div>
            <p className="text-[12px] text-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1"><span>{cur.date}</span>{cur.importSourceId && <span>· {t.s.importSources[cur.importSourceId]?.name}</span>}<Badge tx={cur} /></p>
            {t.note(cur) && <p className="text-[13px] text-text-secondary">{t.note(cur)}</p>}
            {cashMovement(cur) > 0 && <TreatmentPick t={t} tx={cur} />}
            <CategoryPick t={t} tx={cur} />
            {cur.duplicate ? <DuplicateActions t={t} tx={cur} /> : (
              <div className="flex gap-2">
                <button onClick={() => { t.ignore(cur); setOpenId(null); }} className="flex-1 min-h-12 rounded-xl bg-error/10 text-error text-[14px] font-semibold">Ignore</button>
                <button onClick={() => { t.approve(cur); setOpenId(null); }} disabled={!t.ready(cur)} className={`flex-[2] min-h-12 rounded-xl ${accentBtn} border border-accent/35 text-[14px] font-semibold disabled:opacity-50`}>Approve</button>
              </div>
            )}
            <button disabled={!t.canExclude(cur)} onClick={() => { const x = cur; setOpenId(null); setSeedRecordId(x.importRecordId); }} className="min-h-11 text-[13px] text-accent disabled:opacity-50">Exclude Similar Transactions</button>
          </div>
        )}
      </Sheet>
      <ExclusionRuleSheet open={!!seedRecordId} seedRecordId={seedRecordId} onClose={() => setSeedRecordId(undefined)} />
    </div>
  );
};
