import React, { useId, useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import { useAccountsStore } from '../../store/useAccountsStore';
import type { Account, AccountType } from '../../store/useAccountsStore';
import { EmptyState } from '../ui/EmptyState';
import { useUndoStore } from '../../store/useUndoStore';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { PHONE_LIST_LIMIT, useShowMore } from '../../hooks/useShowMore';
import { ShowMoreButton } from '../ui/ShowMoreButton';
import { useAccountValuation } from '../../hooks/useAccountValuation';
import type { AccountCurrency } from '../../store/useAccountsStore';

const format = (amount: number, currency: AccountCurrency) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency, currencyDisplay: currency === 'USD' ? 'code' : 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amount);

interface AccountCategoryWidgetProps {
  title: string;
  type: AccountType;
  className?: string;
}

const SINGULAR_NOUN: Record<AccountType, string> = {
  bank: 'bank account',
  investment: 'investment account',
  debt: 'debt',
  receivable: 'receivable',
  other: 'other asset',
};

const PLURAL_NOUN: Record<AccountType, string> = {
  bank: 'bank accounts',
  investment: 'investment accounts',
  debt: 'debts',
  receivable: 'receivables',
  other: 'other assets',
};

const AddAccountModal = React.lazy(() =>
  import('./AddAccountModal').then((module) => ({ default: module.AddAccountModal }))
);

export const AccountCategoryWidget: React.FC<AccountCategoryWidgetProps> = ({ title, type, className }) => {
  const { getAccountsByType, removeAccount, addAccount } = useAccountsStore();
  const valuation = useAccountValuation();
  const offerUndo = useUndoStore((s) => s.offerUndo);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalOpenedBefore, setModalOpenedBefore] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const accounts = getAccountsByType(type);
  const total = valuation.totals[type];

  // Rule 4 of docs/mobile-layout-rules.md: see IncomeWidget.
  const isDesktop = useIsDesktop();
  const list = useShowMore(accounts, PHONE_LIST_LIMIT, !isDesktop);
  const listId = useId();

  const handleAdd = () => {
    setEditingAccount(null);
    setModalOpenedBefore(true);
    setIsModalOpen(true);
  };

  const handleEdit = (acc: Account) => {
    setEditingAccount(acc);
    setModalOpenedBefore(true);
    setIsModalOpen(true);
  };

  const ActionButton = (
    <button
      onClick={handleAdd}
      className="flex items-center text-xs font-medium text-text-secondary hover:text-accent transition-colors px-2 py-1.5 -my-1.5 -mx-2 rounded-md"
    >
      <Plus size={16} className="mr-1" />
      Add
    </button>
  );

  // Rule 5 of docs/mobile-layout-rules.md. An empty group on the phone
  // Dashboard used to cost a 297px card (a zero total, an illustration and a
  // second Add button) for each of up to five groups. The header's Add stays.
  if (!isDesktop && accounts.length === 0) {
    return (
      <>
        <WidgetWrapper title={title} action={ActionButton} className={className}>
          <p className="text-[13px] text-text-secondary">No {PLURAL_NOUN[type]} yet.</p>
        </WidgetWrapper>
        {modalOpenedBefore && <React.Suspense fallback={null}>
          <AddAccountModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} defaultType={type} editingAccount={editingAccount} />
        </React.Suspense>}
      </>
    );
  }

  return (
    <>
      <WidgetWrapper title={title} action={ActionButton} className={className}>
        <div className="flex flex-col h-full pt-2">
          <div className="text-[24px] font-bold text-text-primary mb-4 border-b border-border pb-3">
            {total === null ? 'Conversion Needed' : format(total, 'CAD')}
          </div>
          
          <div
            id={listId}
            className={`flex-1 flex flex-col divide-y divide-border ${isDesktop ? 'overflow-y-auto max-h-[150px] pr-2' : ''}`}
          >
            {accounts.length === 0 ? (
              <EmptyState
                message="No accounts yet"
                hint={`Add your first ${SINGULAR_NOUN[type]} to start tracking.`}
                action={{ label: 'Add account', onClick: handleAdd }}
              />
            ) : (
              // On a phone the name column collapsed to about 115px while
              // real account names need 140px to 220px, so every name was
              // cut mid-word. Stacking name over value on mobile gives the
              // name the full card width; desktop keeps the single row.
              list.visible.map((acc) => (
                <div
                  key={acc.id}
                  data-testid={`account-row-${acc.id}`}
                  // desktop:flex-wrap: the value block is shrink-0 and, on the
                  // narrowest single-column tablet card (a widget with only
                  // one long-named, high-value row, e.g. the mortgage), its
                  // own content alone is nearly as wide as the whole row.
                  // flex-1 plus min-w-0 on the name would then get squeezed to
                  // 0 no matter how the name itself wraps. Allowing the row to
                  // wrap lets the value block drop to its own line instead,
                  // the same stacked look mobile already uses, only reached
                  // here by the content not fitting rather than by viewport.
                  className="flex flex-col items-start gap-0.5 desktop:flex-row desktop:flex-wrap desktop:justify-between desktop:items-baseline desktop:gap-3 group py-3 first:pt-0"
                >
                  <span
                    data-testid={`account-name-${acc.id}`}
                    // The value block and its two icon buttons are shrink-0, so
                    // on a 2-column tablet grid the name column collapsed to
                    // 11px while real names need 79px to 220px. Letting the
                    // name wrap instead of truncate keeps it readable at every
                    // width the single-line row is used at. desktop:min-w-[70px]
                    // gives the name a floor so the flex algorithm reports the
                    // line as too narrow to fit both children when the value
                    // block alone is nearly the full row width, which is what
                    // makes desktop:flex-wrap actually trigger instead of
                    // silently shrinking the name to 0.
                    className="text-sm text-text-primary min-w-0 desktop:min-w-[70px] flex-1 break-words"
                  >
                    {acc.name}
                    {acc.currency === 'USD' && <span className="ml-2 inline-block rounded border border-border bg-bg-tertiary px-1.5 py-0.5 text-micro font-medium text-text-secondary align-middle">USD</span>}
                  </span>
                  <div className="flex flex-wrap max-w-full items-center gap-1 shrink-0 self-stretch justify-between desktop:self-auto desktop:justify-end">
                    <div className="flex flex-col items-start desktop:items-end">
                      <span className="text-sm font-medium tabular-nums text-text-primary" aria-label={acc.currency === 'USD' ? format(acc.value, 'USD') : undefined}>{format(acc.value, 'CAD')}</span>
                      {acc.currency === 'USD' && <span className="text-xs tabular-nums text-text-secondary">{valuation.cadById[acc.id] === null ? 'Conversion Needed' : `≈ ${format(valuation.cadById[acc.id]!, 'CAD')}`}</span>}
                    </div>
                    <div className="account-row-actions flex shrink-0">
                    <button
                      onClick={() => handleEdit(acc)}
                      className="shrink-0 p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-text-secondary hover:text-accent reveal-on-hover transition-all rounded-md"
                      aria-label="Edit account"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        removeAccount(acc.id);
                        // The restored account gets a fresh id, because addAccount mints
                        // one; that is acceptable since nothing else references an
                        // account id today.
                        offerUndo(`Deleted account "${acc.name}"`, () =>
                          addAccount({ name: acc.name, value: acc.value, type: acc.type, currency: acc.currency }),
                        );
                      }}
                      className="shrink-0 p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-text-secondary hover:text-error reveal-on-hover transition-all rounded-md"
                      aria-label={`Delete ${acc.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {list.truncates && (
            <ShowMoreButton total={accounts.length} noun="accounts" expanded={list.expanded} onToggle={list.toggle} controls={listId} />
          )}
        </div>
      </WidgetWrapper>

      {modalOpenedBefore && <React.Suspense fallback={null}>
        <AddAccountModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          defaultType={type}
          editingAccount={editingAccount}
        />
      </React.Suspense>}
    </>
  );
};
