import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useBudgetStore } from '../../store/useBudgetStore';
import { ThemedSelect } from '../ui/ThemedSelect';
import { ThemedDatePicker } from '../ui/ThemedDatePicker';
import { NumberInput } from '../ui/NumberInput';
import { Sheet } from '../ui/Sheet';
import { Checkbox } from '../ui/Checkbox';
import { formatMoney, formatMoneyWithCents } from '../planner/format';
import { sharedPeople } from '../../utils/budget/sharedExpenses';
import { entryKindOf, encodeEntryAmounts, type TransactionEntryKind } from '../../utils/budget/transactionKinds';
import { splitRemainder, round2 } from '../../utils/budget/splits';
import { TransactionFormMobile } from './TransactionFormMobile';
import { useIsDesktop } from '../../hooks/useMediaQuery';

import type { Transaction, TransactionSplit } from '../../types/budget';

export type TransactionType = 'expense' | 'income';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTransaction?: Transaction | null;
}

interface TransactionFormProps {
  onClose: () => void;
  initialTransaction?: Transaction | null;
}

function normalizeEntryAmounts(amount: number, slices: TransactionSplit[]) {
  const safePositiveCents = (value: number) => {
    const cents = Math.round(value * 100);
    return Number.isFinite(value) && value > 0 && Number.isSafeInteger(cents) && cents > 0;
  };
  const normalizedAmount = round2(amount);
  const normalizedSplits = slices.map(slice => ({ ...slice, amount: round2(slice.amount) }));
  const remaining = splitRemainder(normalizedAmount, normalizedSplits);
  const invalidAmount = !safePositiveCents(amount) || !Number.isFinite(normalizedAmount);
  const invalidAllocation = slices.some(slice => !safePositiveCents(slice.amount))
    || normalizedSplits.some(slice => !Number.isFinite(slice.amount))
    || !Number.isFinite(remaining) || !Number.isSafeInteger(Math.round(remaining * 100));
  return { amount: normalizedAmount, splits: normalizedSplits, remaining, invalidAmount, invalidAllocation };
}

/** Mounted only while the sheet is open, so useState initialisers are the form
 *  reset. Do not reintroduce an effect that sets state here. */
function TransactionForm({ onClose, initialTransaction }: TransactionFormProps) {
  const addTransaction = useBudgetStore((state) => state.addTransaction);
  const updateTransaction = useBudgetStore((state) => state.updateTransaction);
  const deleteTransaction = useBudgetStore((state) => state.deleteTransaction);
  const categories = useBudgetStore((state) => state.categories);
  const categoryGroups = useBudgetStore((state) => state.categoryGroups);
  const transactions = useBudgetStore((state) => state.transactions);

  const isDesktop = useIsDesktop();
  const enabled = useBudgetStore(state => state.refundsAndPaymentsEnabled);
  const [type, setType] = useState<TransactionEntryKind>(initialTransaction ? entryKindOf(initialTransaction) : 'expense');
  const [settlementAcknowledged, setSettlementAcknowledged] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const categoryList = Object.values(categories).filter((cat) => {
    const group = categoryGroups[cat.groupId];
    return (group?.kind ?? 'expense') === (type === 'income' ? 'income' : 'expense');
  });

  const [amount, setAmount] = useState<number>(initialTransaction && Number.isFinite(initialTransaction.amount)
    ? (type === 'refund-payment' ? Math.abs(initialTransaction.amount) : initialTransaction.amount)
    : 0);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [negativeAmountTyped, setNegativeAmountTyped] = useState(false);
  const [category, setCategory] = useState<string>(
    initialTransaction?.categoryId ?? categoryList[0]?.id ?? '',
  );
  const [date, setDate] = useState<string>(initialTransaction?.date ?? new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>(initialTransaction?.description ?? '');

  const [isShared, setIsShared] = useState(!!initialTransaction?.shared);
  const [totalPaid, setTotalPaid] = useState<number>(initialTransaction?.shared?.totalAmount ?? 0);
  const [sharedWith, setSharedWith] = useState<string>(initialTransaction?.shared?.sharedWith ?? '');
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [isReimbursement, setIsReimbursement] = useState(!!initialTransaction?.reimbursement);
  const [reimbursementFrom, setReimbursementFrom] = useState<string>(initialTransaction?.reimbursement?.from ?? '');

  const [isSplit, setIsSplit] = useState(!!initialTransaction?.splits?.length);
  const [splits, setSplits] = useState<TransactionSplit[]>(
    initialTransaction?.splits?.map(slice => ({ ...slice, amount: type === 'refund-payment' ? Math.abs(slice.amount) : slice.amount })) ?? [{ categoryId: category, amount: 0 }],
  );
  const [tagsText, setTagsText] = useState<string>((initialTransaction?.tags ?? []).join(', '));
  const [note, setNote] = useState<string>(initialTransaction?.note ?? '');

  const normalized = normalizeEntryAmounts(amount, isSplit ? splits.filter(slice => slice.amount !== 0 || !!slice.categoryId) : []);
  const remaining = normalized.remaining;
  const reductionByCategory = new Map<string, number>();
  if (!normalized.invalidAmount && !normalized.invalidAllocation && remaining >= 0) {
    const parts = isSplit
      ? [...normalized.splits, ...(remaining > 0 ? [{ categoryId: category, amount: remaining }] : [])]
      : [{ categoryId: category, amount: normalized.amount }];
    for (const part of parts) {
      if (part.categoryId && categoryList.some(cat => cat.id === part.categoryId) && part.amount > 0) {
        reductionByCategory.set(part.categoryId, round2((reductionByCategory.get(part.categoryId) ?? 0) + part.amount));
      }
    }
  }

  const peopleSuggestions = React.useMemo(() => sharedPeople(transactions), [transactions]);

  const handleTypeChange = (nextType: TransactionEntryKind) => {
    if (nextType === 'refund-payment' && isShared) {
      setValidationError('Turn off Shared bill before using Refunds & Payments. This will discard the shared bill IOU treatment.');
      return;
    }
    setValidationError(null);
    setSettlementAcknowledged(false);
    setType(nextType);
    const nextCategoryList = Object.values(categories).filter((cat) => {
      const group = categoryGroups[cat.groupId];
      return (group?.kind ?? 'expense') === (nextType === 'income' ? 'income' : 'expense');
    });
    setCategory((current) => {
      if (current && !nextCategoryList.some((c) => c.id === current)) {
        return nextCategoryList[0]?.id ?? '';
      }
      return current;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (normalized.invalidAmount) {
      setAmountError('Enter an amount greater than zero.');
      document.getElementById('tx-amount')?.focus();
      return;
    }
    setAmountError(null);

    if (type === 'expense' && amount > 0 && isShared) {
      if (totalPaid < amount) {
        setSharedError('Total I paid must be at least your share.');
        document.getElementById('tx-total-paid')?.focus();
        return;
      }
      if (totalPaid > amount && !sharedWith.trim()) {
        setSharedError('Enter who owes you the rest of this bill.');
        document.getElementById('tx-shared-with')?.focus();
        return;
      }
    }
    setSharedError(null);

    const current = useBudgetStore.getState();
    const validCategory = (id?: string) => {
      const cat = id ? current.categories[id] : undefined;
      const group = cat ? current.categoryGroups[cat.groupId] : undefined;
      return !!group && group.kind === (type === 'income' ? 'income' : 'expense');
    };
    if (normalized.invalidAllocation) {
      setValidationError('Enter an amount greater than zero for every allocation.');
      return;
    }
    const cleanedSplits = normalized.splits;
    const remainder = normalized.remaining;
    if (remainder < 0) {
      setAmountError('Slices add up to more than the amount. Reduce a slice before saving.');
      document.getElementById('tx-amount')?.focus();
      return;
    }
    if ((!isSplit || remainder > 0) && !validCategory(category)) {
      setValidationError('Choose a valid category before saving.');
      return;
    }
    if (cleanedSplits.some(slice => !validCategory(slice.categoryId))) {
      setValidationError('Choose a valid category for every allocation.');
      return;
    }
    if (type === 'refund-payment' && initialTransaction?.reimbursement && !settlementAcknowledged) {
      setValidationError('Confirm how this shared bill payment should be used before saving.');
      return;
    }
    setValidationError(null);
    const encoded = encodeEntryAmounts(type, normalized.amount, cleanedSplits);

    const sharedField =
      type === 'expense' && amount > 0 && isShared && totalPaid > amount && sharedWith.trim()
        ? { totalAmount: totalPaid, sharedWith: sharedWith.trim() }
        : undefined;
    const reimbursementField =
      type === 'income' && isReimbursement && reimbursementFrom.trim()
        ? { from: reimbursementFrom.trim() }
        : undefined;

    const tags = Array.from(
      new Set(
        tagsText
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const tagsField = tags.length > 0 ? tags : undefined;
    const noteField = note.trim() ? note.trim() : undefined;

    if (initialTransaction) {
      updateTransaction(initialTransaction.id, {
        ...encoded,
        categoryId: category,
        date,
        description,
        shared: sharedField,
        reimbursement: reimbursementField,
        tags: tagsField,
        note: noteField
      });
    } else {
      addTransaction({
        id: crypto.randomUUID(),
        ...encoded,
        categoryId: category,
        date,
        description,
        shared: sharedField,
        reimbursement: reimbursementField,
        tags: tagsField,
        note: noteField
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (initialTransaction) {
      deleteTransaction(initialTransaction.id);
      onClose();
    }
  };

  const refundNotice = (
    type === 'refund-payment' && (!enabled || !!initialTransaction?.reimbursement || reductionByCategory.size > 0) && (
            <div className="flex flex-col gap-2 text-[12px] text-[var(--color-text-secondary)]">
              {!enabled && <p>Refunds &amp; Payments is off for new transactions. This saved payment still counts.</p>}
              {initialTransaction?.reimbursement && <>
                <p>This payment currently settles a shared bill. Using it to reduce expenses will stop settling that balance. Shared bills already count only your share, so this can reduce spending again.</p>
                <label className="flex items-start gap-2">
                  <Checkbox checked={settlementAcknowledged} onChange={setSettlementAcknowledged} ariaLabel="Use this payment to reduce expenses instead of settling the shared bill." />
                  Use this payment to reduce expenses instead of settling the shared bill.
                </label>
              </>}
              {[...reductionByCategory].map(([categoryId, reduction]) => <p key={categoryId}>Reduces {categories[categoryId].name} spending by {formatMoneyWithCents(reduction)}</p>)}
            </div>
          )
  );

  const amountHint = negativeAmountTyped ? <p className="text-[12px] text-[var(--color-text-secondary)]">Use Refunds &amp; Payments for money received.</p> : null;

  if (!isDesktop) {
    return (
      <TransactionFormMobile
        editing={!!initialTransaction}
        type={type}
        onTypeChange={handleTypeChange}
        showRefundOption={!!(enabled || (initialTransaction && entryKindOf(initialTransaction) === 'refund-payment'))}
        validationError={validationError}
        notice={refundNotice}
        amount={amount}
        onAmountCommit={(v) => { setAmount(v); if (v > 0) setAmountError(null); }}
        onAmountText={(text) => {
          setNegativeAmountTyped(text.startsWith('-'));
          if (Number.isNaN(parseFloat(text))) setAmount(0);
        }}
        amountError={amountError}
        amountHint={amountHint}
        isShared={isShared}
        onSharedChange={(checked) => {
          setIsShared(checked);
          setSharedError(null);
          if (checked && totalPaid === 0 && amount > 0) setTotalPaid(amount);
        }}
        totalPaid={totalPaid}
        onTotalPaidChange={setTotalPaid}
        onSharePreset={(f) => setAmount(Math.round(totalPaid * f * 100) / 100)}
        sharedWith={sharedWith}
        onSharedWithChange={setSharedWith}
        sharedError={sharedError}
        isReimbursement={isReimbursement}
        onReimbursementChange={setIsReimbursement}
        reimbursementFrom={reimbursementFrom}
        onReimbursementFromChange={setReimbursementFrom}
        category={category}
        onCategoryChange={setCategory}
        categoryOptions={[{ value: '', label: 'Uncategorized' }, ...categoryList.map((cat) => ({ value: cat.id, label: cat.name }))]}
        isSplit={isSplit}
        onSplitChange={setIsSplit}
        splits={splits}
        onSplitsChange={setSplits}
        remaining={remaining}
        allocationInvalid={normalized.invalidAmount || normalized.invalidAllocation}
        tagsText={tagsText}
        onTagsChange={setTagsText}
        note={note}
        onNoteChange={setNote}
        date={date}
        onDateChange={setDate}
        description={description}
        onDescriptionChange={setDescription}
        peopleList={<datalist id="shared-people">{peopleSuggestions.map((p) => <option key={p} value={p} />)}</datalist>}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <>
        <div className="hidden desktop:flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-[18px] font-semibold leading-[1.2] text-[var(--color-text-primary)]">
            {initialTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 rounded-md overflow-hidden border border-[var(--color-border)]">
            {(['expense', 'income', ...(enabled || (initialTransaction && entryKindOf(initialTransaction) === 'refund-payment') ? ['refund-payment'] : [])] as TransactionEntryKind[]).map(kind => (
              <button key={kind} type="button" aria-pressed={type === kind}
                className={`${kind === 'refund-payment' ? 'col-span-2 border-t border-[var(--color-border)]' : ''} min-h-[44px] py-2 text-[14px] font-medium transition-colors ${type === kind ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                onClick={() => handleTypeChange(kind)}>
                {kind === 'expense' ? 'Expense' : kind === 'income' ? 'Income' : 'Refunds & Payments'}
              </button>
            ))}
          </div>
          {validationError && <p role="alert" className="text-[12px] text-error">{validationError}</p>}
          {refundNotice}
          <div className="flex flex-col gap-2">
            <label htmlFor="tx-amount" className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">
              {type === 'expense' && isShared ? 'Your share' : 'Amount'}
            </label>
            <NumberInput
              id="tx-amount"
              value={amount}
              onTextChange={(text) => {
                setNegativeAmountTyped(text.startsWith('-'));
                if (Number.isNaN(parseFloat(text))) setAmount(0);
              }}
              onCommit={(v) => { setAmount(v); if (v > 0) setAmountError(null); }}
              aria-invalid={amountError ? 'true' : 'false'}
              aria-describedby={amountError ? 'tx-amount-error' : undefined}
              className={`w-full bg-[var(--color-bg-secondary)] border rounded-md p-2 text-[14px] text-[var(--color-text-primary)] transition-colors ${
                amountError
                  ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                  : 'border-[var(--color-border)] focus:border-[var(--color-accent)]'
              }`}
              placeholder="0.00"
            />
            {amountHint}
            {amountError && (
              <p id="tx-amount-error" role="alert" className="text-[12px] text-error">
                {amountError}
              </p>
            )}
          </div>

          {type === 'expense' && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
                <Checkbox checked={isShared} onChange={(checked) => {
                  setIsShared(checked);
                  setSharedError(null);
                  if (checked && totalPaid === 0 && amount > 0) setTotalPaid(amount);
                }} ariaLabel="Shared bill" />
                Shared bill (I paid for others too)
              </label>
              {isShared && (
                <div className="flex flex-col gap-2 pl-1 border-l-2 border-[var(--color-border)] ml-1">
                  <label htmlFor="tx-total-paid" className="text-[12px] font-medium text-[var(--color-text-secondary)]">Total I paid</label>
                  <NumberInput
                    id="tx-total-paid"
                    value={totalPaid}
                    onCommit={setTotalPaid}
                    min={0}
                    aria-describedby={sharedError ? 'tx-shared-error' : undefined}
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] transition-colors"
                    placeholder="0.00"
                  />
                  <div className="flex gap-2">
                    {[0.5, 1 / 3, 0.25].map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={totalPaid <= 0}
                        onClick={() => setAmount(Math.round(totalPaid * f * 100) / 100)}
                        className="px-2 py-1 rounded-md text-[12px] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        My share {['50%', '33%', '25%'][i]}
                      </button>
                    ))}
                  </div>
                  <p className="text-meta text-[var(--color-text-secondary)]">
                    Amount above is your share; the rest ({formatMoney(Math.max(0, totalPaid - amount))}) is owed to you.
                  </p>
                  <label htmlFor="tx-shared-with" className="text-[12px] font-medium text-[var(--color-text-secondary)]">Shared with</label>
                  <input
                    id="tx-shared-with"
                    type="text"
                    list="shared-people"
                    value={sharedWith}
                    onChange={(e) => setSharedWith(e.target.value)}
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] transition-colors"
                    placeholder="e.g. Alex, roommates"
                    aria-describedby={sharedError ? 'tx-shared-error' : undefined}
                  />
                  {sharedError && <p id="tx-shared-error" role="alert" className="text-[12px] text-error">{sharedError}</p>}
                </div>
              )}
            </div>
          )}
          {type === 'income' && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
                <Checkbox checked={isReimbursement} onChange={setIsReimbursement} ariaLabel="Reimbursement for a shared bill" />
                Reimbursement for a shared bill (not income)
              </label>
              {isReimbursement && (
                <input
                  type="text"
                  list="shared-people"
                  value={reimbursementFrom}
                  onChange={(e) => setReimbursementFrom(e.target.value)}
                  className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] transition-colors"
                  placeholder="Who paid you back?"
                />
              )}
            </div>
          )}
          <datalist id="shared-people">
            {peopleSuggestions.map((p) => <option key={p} value={p} />)}
          </datalist>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">
              Category
            </label>
            <ThemedSelect
              ariaLabel="Category"
              value={category}
              onChange={(v) => setCategory(v)}
              options={[
                { value: '', label: 'Uncategorized' },
                ...categoryList.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
            />
          </div>

          {amount >= 0 && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
              <Checkbox checked={isSplit} onChange={setIsSplit} ariaLabel="Split across categories" />
              Split across categories
            </label>
            {isSplit && (
              <div className="flex flex-col gap-2 pl-1 border-l-2 border-[var(--color-border)] ml-1">
                {splits.map((slice, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1 basis-36">
                      <ThemedSelect
                        ariaLabel="Slice category"
                        value={slice.categoryId ?? ''}
                        onChange={(v) =>
                          setSplits((cur) => cur.map((s, j) => (j === i ? { ...s, categoryId: v } : s)))
                        }
                        className="flex-1 text-[12px]"
                        options={[
                          { value: '', label: 'Uncategorized' },
                          ...categoryList.map((cat) => ({ value: cat.id, label: cat.name })),
                        ]}
                      />
                    </div>
                    <NumberInput
                      id={`tx-split-amount-${i}`}
                      value={slice.amount}
                      onTextChange={(text) => {
                        if (Number.isNaN(parseFloat(text))) setSplits(cur => cur.map((s, j) => j === i ? { ...s, amount: 0 } : s));
                      }}
                      onCommit={(v) =>
                        setSplits((cur) => cur.map((s, j) => (j === i ? { ...s, amount: v } : s)))
                      }
                      ariaLabel="Slice amount"
                      className="w-28 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)]"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      aria-label="Remove slice"
                      onClick={() => setSplits((cur) => cur.filter((_, j) => j !== i))}
                      className="p-2 text-[var(--color-text-secondary)] hover:text-error rounded-md"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSplits((cur) => [...cur, { categoryId: '', amount: 0 }])}
                  className="self-start px-2 py-1 rounded-md text-[12px] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
                >
                  Add a slice
                </button>
                <p className="text-meta text-[var(--color-text-secondary)]">
                  {normalized.invalidAmount || normalized.invalidAllocation
                    ? 'Enter valid amounts to see the allocation remainder.'
                    : remaining > 0
                    ? `${formatMoneyWithCents(remaining)} left to allocate, which stays on the category above.`
                    : remaining < 0
                      ? `Slices exceed the amount by ${formatMoney(Math.abs(remaining))}.`
                      : 'Fully allocated.'}
                </p>
              </div>
            )}
          </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="tx-tags" className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">
              Tags
            </label>
            <input
              id="tx-tags"
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] transition-colors"
              placeholder="Comma separated, e.g. trip, reimbursable"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="tx-note" className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">
              Note
            </label>
            <textarea
              id="tx-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] transition-colors"
              placeholder="Anything you want to remember about this one"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">
              Date
            </label>
            <ThemedDatePicker
              value={date}
              onChange={setDate}
              className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] rounded-md text-[14px] focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="tx-description" className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">
              Description (Optional)
            </label>
            <input
              id="tx-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] transition-colors"
              placeholder="e.g. Groceries at Trader Joe's"
            />
          </div>

          <div className="pt-2 mt-2 border-t border-[var(--color-border)] flex gap-2">
            {initialTransaction && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-3 bg-error/10 text-error rounded-md text-[14px] font-medium hover:bg-error/20 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
            >
              {initialTransaction ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
    </>
  );
}

export function TransactionModal({ isOpen, onClose, initialTransaction }: TransactionModalProps) {
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      desktop="modal"
      ariaLabel={initialTransaction ? 'Edit Transaction' : 'Add Transaction'}
      // The phone Add form has its own pinned Add Transaction button, so no title row above it.
      title={initialTransaction ? 'Edit Transaction' : undefined}
      panelClassName="w-full max-w-md bg-[var(--color-bg-primary)] desktop:rounded-xl shadow-lg border border-[var(--color-border)] desktop:overflow-hidden"
    >
      <TransactionForm key={initialTransaction?.id ?? 'new'} onClose={onClose} initialTransaction={initialTransaction} />
    </Sheet>
  );
}
