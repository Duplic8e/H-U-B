import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from './storageKeys'
import { v4 as uuidv4 } from 'uuid';
import { netWorthTrend, valueAccounts } from '../utils/accounts/accountValuation'

export type AccountType = 'bank' | 'investment' | 'debt' | 'receivable' | 'other';
export type AccountCurrency = 'CAD' | 'USD';

export interface Account {
  id: string;
  name: string;
  value: number;
  type: AccountType;
  currency: AccountCurrency;
}

export type NewAccount = Omit<Account, 'id' | 'currency'> & { currency?: AccountCurrency }

export interface NetWorthSnapshot {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface NormalizedAccountState {
  accounts: Account[];
  history: NetWorthSnapshot[];
  pendingCurrencyReviewIds: string[];
  currencySupportStartedAt: string;
  pendingEditSnapshotDate: string | null;
}

interface AccountsState {
  accounts: Account[];
  history: NetWorthSnapshot[];
  pendingCurrencyReviewIds: string[];
  currencySupportStartedAt: string;
  pendingEditSnapshotDate: string | null;
  addAccount: (account: NewAccount) => void;
  updateAccount: (id: string, updates: Partial<Omit<Account, 'id'>>) => void;
  removeAccount: (id: string) => void;
  confirmCurrencyReview: (currencies: Record<string, AccountCurrency>) => void;
  getAccountsByType: (type: AccountType) => Account[];
  getTotalByType: (type: AccountType, usdCadRate?: number) => number | null;
  getNetWorth: (usdCadRate?: number) => number | null;
  recordSnapshot: (usdCadRate?: number) => void;
  getNetWorthTrend: (usdCadRate?: number) => number | null;
  setSnapshot: (date: string, value: number) => void;
  removeSnapshot: (date: string) => void;
  ensureDailySnapshot: (usdCadRate?: number) => void;
}

/** The demo accounts every install used to boot with, before 0.8.1-beta. Kept
 *  so the migration can recognise and remove them. */
export const DEMO_ACCOUNTS: Account[] = [
  { id: '1', name: 'Main Checking', value: 15000, type: 'bank', currency: 'CAD' },
  { id: '2', name: 'Vanguard 401k', value: 120000, type: 'investment', currency: 'CAD' },
  { id: '3', name: 'Mortgage', value: 350000, type: 'debt', currency: 'CAD' },
  { id: '4', name: 'Personal Loan to Bob', value: 5000, type: 'receivable', currency: 'CAD' },
]

/** A fresh install no longer ships demo accounts. Existing installs drop the
 *  four seeded rows only if they are still present untouched. A row the user
 *  renamed, revalued, or retyped is theirs now and is kept, as is anything
 *  they added. If, and only if, at least one demo row was actually removed,
 *  the net worth history is cleared too: those snapshots were computed while
 *  the fake demo money was included in the total, so they no longer describe
 *  the user's real net worth and cannot be salvaged. A user whose accounts
 *  never matched a demo row (they had already deleted them, or never had
 *  them) keeps their history untouched, since it is genuine.
 *
 *  This runs on every rehydration (via `merge`), not gated by a stored
 *  version number, so that older builds without this logic can still read a
 *  snapshot written by this build (see the persist options below for why the
 *  `version` field itself is intentionally omitted). Once the demos are gone
 *  it is a no-op: nothing matches, nothing is removed, history is untouched. */
export function stripDemoAccounts(persisted: unknown): unknown {
  const state = persisted as { accounts?: Account[]; history?: NetWorthSnapshot[] } | null
  if (!state?.accounts || !Array.isArray(state.accounts)) return persisted
  const accounts = state.accounts.filter(
    (a) =>
      !DEMO_ACCOUNTS.some(
        (d) => d.id === a.id && d.name === a.name && d.value === a.value && d.type === a.type,
      ),
  )
  const removedAny = accounts.length !== state.accounts.length
  return { ...state, accounts, ...(removedAny ? { history: [] } : {}) }
}

function assertAccountCurrency(currency: unknown): asserts currency is AccountCurrency {
  if (currency !== 'CAD' && currency !== 'USD') {
    throw new Error(`Unsupported account currency: ${String(currency)}`)
  }
}

/** Adds currency metadata to legacy payloads without altering balances or history. */
export function normalizeAccountState(persisted: unknown, today = new Date().toISOString().slice(0, 10)): unknown {
  if (typeof persisted !== 'object' || persisted === null || Array.isArray(persisted)) return persisted
  const state = persisted as Record<string, unknown>
  if (!Array.isArray(state.accounts)) return persisted

  const newlyPending: string[] = []
  const accounts = state.accounts.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return item
    const account = item as Record<string, unknown>
    if (account.currency === undefined) {
      if (typeof account.id === 'string') newlyPending.push(account.id)
      return { ...account, currency: 'CAD' }
    }
    assertAccountCurrency(account.currency)
    return account
  })
  const ids = new Set(accounts.map((account: unknown) =>
    typeof account === 'object' && account !== null && 'id' in account ? (account as { id: unknown }).id : undefined,
  ))
  const previous = Array.isArray(state.pendingCurrencyReviewIds)
    ? state.pendingCurrencyReviewIds.filter((id): id is string => typeof id === 'string' && ids.has(id))
    : []
  return {
    ...state,
    accounts,
    pendingCurrencyReviewIds: [...new Set([...previous, ...newlyPending])],
    currencySupportStartedAt: typeof state.currencySupportStartedAt === 'string' && state.currencySupportStartedAt
      ? state.currencySupportStartedAt : today,
    pendingEditSnapshotDate: typeof state.pendingEditSnapshotDate === 'string' ? state.pendingEditSnapshotDate : null,
  }
}

function persistNormalizedAccountStateAfterHydration(): void {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(STORAGE_KEYS.accounts)
  if (!raw) return
  const envelope = JSON.parse(raw) as Record<string, unknown>
  if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) return
  const normalized = normalizeAccountState(stripDemoAccounts(envelope.state))
  if (JSON.stringify(normalized) === JSON.stringify(envelope.state)) return
  // Zustand does not write a version-less entry after merge. Write only after
  // hydration succeeds so normalization failures leave the original intact.
  const next: Record<string, unknown> = { ...envelope, state: normalized }
  delete next.version
  localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(next))
}

let accountHydrationError: Error | null = null

function assertAccountHydrated(): void {
  if (accountHydrationError) {
    throw new Error(`Account data could not be loaded: ${accountHydrationError.message}. Correct the saved data and reload it before editing accounts.`, { cause: accountHydrationError })
  }
}

export const useAccountsStore = create<AccountsState>()(
  persist(
    (baseSet, get) => {
      const set: typeof baseSet = (...args) => {
        assertAccountHydrated()
        Reflect.apply(baseSet, undefined, args)
      }
      return ({
      accounts: [],
      history: [],
      pendingCurrencyReviewIds: [],
      currencySupportStartedAt: new Date().toISOString().slice(0, 10),
      pendingEditSnapshotDate: null,

      addAccount: (accountData) => {
        set((state) => ({
          accounts: [...state.accounts, { ...accountData, currency: accountData.currency ?? 'CAD', id: uuidv4() }],
        }));
        get().recordSnapshot();
      },

      updateAccount: (id, updates) => {
        set((state) => ({
          accounts: state.accounts.map((acc) => 
            acc.id === id ? { ...acc, ...updates } : acc
          ),
        }));
        get().recordSnapshot();
      },

      removeAccount: (id) => {
        set((state) => ({
          accounts: state.accounts.filter((acc) => acc.id !== id),
          pendingCurrencyReviewIds: state.pendingCurrencyReviewIds.filter((pendingId) => pendingId !== id),
        }));
        get().recordSnapshot();
      },

      confirmCurrencyReview: (currencies) => {
        Object.values(currencies).forEach(assertAccountCurrency)
        const pending = new Set(get().pendingCurrencyReviewIds)
        set((state) => ({
          accounts: state.accounts.map((account) => pending.has(account.id) && currencies[account.id]
            ? { ...account, currency: currencies[account.id] }
            : account),
          pendingCurrencyReviewIds: state.pendingCurrencyReviewIds.filter((id) => !currencies[id]),
        }))
        get().recordSnapshot()
      },

      getAccountsByType: (type) => {
        return get().accounts.filter((acc) => acc.type === type);
      },

      getTotalByType: (type, usdCadRate) => valueAccounts(get().accounts, usdCadRate).totals[type],

      getNetWorth: (usdCadRate) => valueAccounts(get().accounts, usdCadRate).netWorth,

      recordSnapshot: (usdCadRate) => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        const currentNetWorth = state.getNetWorth(usdCadRate);
        if (currentNetWorth === null) {
          set({ pendingEditSnapshotDate: today });
          return;
        }

        set((state) => {
          const existingIndex = state.history.findIndex(h => h.date === today);
          const newHistory = [...state.history];

          if (existingIndex >= 0) {
            newHistory[existingIndex] = { date: today, value: currentNetWorth };
          } else {
            newHistory.push({ date: today, value: currentNetWorth });
          }

          newHistory.sort((a, b) => a.date.localeCompare(b.date));

          return { history: newHistory, pendingEditSnapshotDate: null };
        });
      },

      setSnapshot: (date, value) =>
        set((state) => {
          const history = state.history.filter((h) => h.date !== date);
          history.push({ date, value });
          history.sort((a, b) => a.date.localeCompare(b.date));
          return { history };
        }),

      removeSnapshot: (date) =>
        set((state) => ({ history: state.history.filter((h) => h.date !== date) })),

      /** Called once when the app opens. Without this the trend chart is sampled
       *  by the user's editing habits rather than by time: a month of no account
       *  edits leaves a month-wide gap. An existing entry for today is left
       *  alone so a manual correction is never overwritten, and an install with
       *  no accounts records nothing rather than a misleading zero. */
      ensureDailySnapshot: (usdCadRate) => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        if (state.pendingEditSnapshotDate) {
          if (state.pendingEditSnapshotDate !== today) {
            set({ pendingEditSnapshotDate: null });
          } else if (state.getNetWorth(usdCadRate) !== null) {
            state.recordSnapshot(usdCadRate);
            return;
          } else {
            return;
          }
        }
        if (state.accounts.length === 0) return;
        if (state.history.some((h) => h.date === today)) return;
        const value = state.getNetWorth(usdCadRate);
        if (value === null) return;
        set((current) => ({
          history: [...current.history, { date: today, value }].sort((a, b) => a.date.localeCompare(b.date)),
        }));
      },

      getNetWorthTrend: (usdCadRate) => {
        const state = get();
        return netWorthTrend(state.getNetWorth(usdCadRate), state.history);
      },
      })
    },
    {
      name: STORAGE_KEYS.accounts,
      // Intentionally no `version` here. zustand writes `{ state, version:
      // options.version }`, and with `options.version` undefined,
      // JSON.stringify drops the key entirely, so a snapshot written by this
      // build stays version-less and a build on the previous release can
      // still read it on its normal (non-migrate) path instead of falling
      // back to its initial state. The demo-account cleanup lives in
      // `merge`, which zustand calls on every rehydration regardless of
      // version. `migrate` is kept only as a self-heal path for a machine
      // that already has `"version": 1` written to localStorage from an
      // earlier build of this same branch: with `options.version` undefined
      // and a stored version of 1, zustand still detects a mismatch and
      // calls `migrate` rather than discarding the state. After that one
      // load the entry is rewritten without a version field and the machine
      // is healed.
      migrate: (persisted) => normalizeAccountState(stripDemoAccounts(persisted)),
      merge: (persisted, current) => ({ ...current, ...(normalizeAccountState(stripDemoAccounts(persisted)) as object) }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          accountHydrationError = error instanceof Error ? error : new Error(String(error))
          return
        }
        try {
          persistNormalizedAccountStateAfterHydration()
          accountHydrationError = null
        } catch (writeError) {
          accountHydrationError = writeError instanceof Error ? writeError : new Error(String(writeError))
        }
      },
    }
  )
);

// Persist's public setState bypasses the action closure, so guard it as well.
const setAccountState = useAccountsStore.setState
useAccountsStore.setState = ((...args) => {
  assertAccountHydrated()
  return Reflect.apply(setAccountState, undefined, args)
}) as typeof useAccountsStore.setState

// Zustand reports hydration errors only to onRehydrateStorage. Make an
// explicit retry reject with the same clear error, then allow edits after a
// corrected payload has loaded successfully.
const rehydrateAccounts = useAccountsStore.persist.rehydrate
useAccountsStore.persist.rehydrate = async () => {
  await rehydrateAccounts()
  assertAccountHydrated()
}
