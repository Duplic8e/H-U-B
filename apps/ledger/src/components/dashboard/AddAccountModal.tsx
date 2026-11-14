import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAccountsStore } from '../../store/useAccountsStore';
import type { Account, AccountCurrency, AccountType } from '../../store/useAccountsStore';
import { ThemedSelect } from '../ui/ThemedSelect';
import { NumberInput } from '../ui/NumberInput';
import { Sheet } from '../ui/Sheet';
import { CurrencyChangeConfirmation } from '../accounts/CurrencyChangeConfirmation';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: AccountType;
  editingAccount?: Account | null;
}

interface AccountFormProps {
  initial: Account | null;
  defaultType: AccountType;
  onDone: () => void;
}

/** Mounted only while the sheet is open, so its useState initialisers are the
 *  form reset. No effect is needed, and none may be added: setting state from
 *  an effect here is what caused the cascading renders this replaced. */
const AccountForm: React.FC<AccountFormProps> = ({ initial, defaultType, onDone }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [value, setValue] = useState(initial?.value ?? 0);
  const [type, setType] = useState<AccountType>(initial?.type ?? defaultType);
  const [currency, setCurrency] = useState<AccountCurrency>(initial?.currency ?? 'CAD');
  const [confirming, setConfirming] = useState(false);

  const { addAccount, updateAccount } = useAccountsStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    if (initial) {
      if (currency !== initial.currency) {
        setConfirming(true);
        return;
      }
      updateAccount(initial.id, { name, value, type, currency });
    } else {
      addAccount({ name, value, type, currency });
    }
    onDone();
  };

  if (initial && confirming) return <CurrencyChangeConfirmation
    changes={[{ id: initial.id, name, value, from: initial.currency, to: currency }]}
    onCancel={() => setConfirming(false)}
    onConfirm={() => { updateAccount(initial.id, { name, value, type, currency }); onDone(); }}
  />;

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-secondary">Type</label>
        <ThemedSelect
          value={type}
          onChange={(v) => setType(v as AccountType)}
          options={[
            { value: 'bank', label: 'Bank Account' },
            { value: 'investment', label: 'Investment Account' },
            { value: 'debt', label: 'Debt / Liability' },
            { value: 'receivable', label: 'Receivable' },
            { value: 'other', label: 'Other Asset' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="account-name" className="text-sm font-medium text-text-secondary">Name / Description</label>
        <input
          id="account-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chase Checking"
          className="bg-bg-secondary border border-border rounded-md px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          required
        />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-[2_1_170px] min-w-0">
          <label htmlFor="account-balance" className="text-sm font-medium text-text-secondary">{currency === 'USD' ? 'Balance (USD)' : 'Balance'}</label>
          <NumberInput id="account-balance" value={value} onCommit={setValue} placeholder="0.00"
            className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent" />
        </div>
        <div className="flex flex-col gap-1 flex-[1_1_100px] min-w-[100px]">
          <label className="text-sm font-medium text-text-secondary">Currency</label>
          <ThemedSelect ariaLabel="Currency" value={currency} onChange={(next) => setCurrency(next as AccountCurrency)}
            options={[{ value: 'CAD', label: 'CAD' }, { value: 'USD', label: 'USD' }]} />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-accent text-[var(--color-bg-primary)] rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {initial ? 'Save Changes' : 'Add Account'}
        </button>
      </div>
    </form>
  );
};

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ isOpen, onClose, defaultType = 'bank', editingAccount }) => (
  <Sheet
    open={isOpen}
    onClose={onClose}
    desktop="modal"
    ariaLabel={editingAccount ? 'Edit Account' : 'Add Account'}
    title={editingAccount ? 'Edit Account' : 'Add Account'}
    panelClassName="bg-bg-primary border border-border desktop:rounded-xl shadow-xl w-full max-w-md desktop:overflow-hidden flex flex-col"
  >
    <div className="hidden desktop:flex justify-between items-center p-4 border-b border-border">
      <h2 className="text-lg font-semibold text-text-primary">{editingAccount ? 'Edit Account' : 'Add Account'}</h2>
      <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded">
        <X size={20} />
      </button>
    </div>
    <AccountForm
      key={editingAccount?.id ?? `new-${defaultType}`}
      initial={editingAccount ?? null}
      defaultType={defaultType}
      onDone={onClose}
    />
  </Sheet>
);
