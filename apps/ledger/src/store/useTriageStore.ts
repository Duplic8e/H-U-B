import { cashMovement, entryKindOf, hasValidPendingCategory } from '../utils/budget/transactionKinds';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from './storageKeys'
import type { TriageTransaction } from '../types/triage';
import { useBudgetStore } from './useBudgetStore';
import { v4 as uuidv4 } from 'uuid';
import { matchImport } from '../utils/budget/importHistory';
import type { ImportDay, ImportRecord, ImportReport, ImportSource } from '../types/importHistory';
import { useUndoStore } from './useUndoStore';
import type { ExclusionRule, ExclusionRuleDraft } from '../types/exclusionRules';
import { validateExclusionDraft } from '../utils/budget/exclusionRules';
import { applyImportExclusions } from '../utils/budget/applyImportExclusions';
import { merchantKey } from '../utils/budget/merchant';
import { guessCategory } from '../utils/autoCategorize';

interface TriageState {
  pendingTransactions: Record<string, TriageTransaction>;
  categoryRules: Record<string, string>;
  exclusionRules: Record<string, ExclusionRule>;
  importSources: Record<string, ImportSource>;
  importRecords: Record<string, ImportRecord>;
  importDays: ImportDay[];
  lastImport: ImportReport | null;
  /** When transactions were last imported (ISO date), for the monthly reminder. */
  lastImportAt?: string;
  saveExclusionRule: (draft: ExclusionRuleDraft, options?: { id?: string; applyPending?: boolean }) => string;
  setExclusionRuleEnabled: (id: string, enabled: boolean) => void;
  deleteExclusionRule: (id: string) => void;
  applyExclusionRulesToPending: () => string[];
  includeExclusionMatch: (id: string) => void;
  excludeExclusionMatches: (ids: string[]) => string[];
  createImportSource: (name: string, bankKey?: string) => string;
  bindImportSource: (sourceId: string, bankKey: string) => void;
  importTransactions: (rows: TriageTransaction[], sourceId: string) => ImportReport;
  restoreImportRecord: (id: string) => void;
  /** Sends every excluded or ignored import back to review. Returns their ids. */
  restoreAllExcluded: () => string[];
  /** Moves rows set aside as transfers or card payments into the Categorize
   *  queue, where they can be filed or left out like anything else. */
  includeSetAside: () => string[];
  resolveDuplicate: (id: string) => void;
  
  addPending: (transactions: TriageTransaction[]) => void;
  updatePending: (id: string, updates: Partial<TriageTransaction>) => void;
  setPendingReceiptTreatment: (id: string, treatment: 'income' | 'refund-payment') => void;
  /** Adds one row to the budget. `learn: false` files it without teaching a
   *  rule, for a one-off like a single Amazon order in an unusual category. */
  approveTransaction: (id: string, options?: { learn?: boolean }) => void;
  /** Files these rows under one category and adds them to the budget. With
   *  `learn`, it also remembers the merchant and files every other waiting row
   *  from that merchant. Returns every id it added. */
  categorizeAndAdd: (ids: string[], categoryId: string, options?: { learn?: boolean }) => string[];
  /** Adds every waiting row a learned rule matches. Returns the ids added. */
  addRuleMatches: () => string[];
  /** Approves every row that is neither flagged as a duplicate nor held back by
   *  a flag. Returns the ids it approved, so the caller can offer to undo the
   *  batch. */
  approveAll: () => string[];
  rejectDuplicates: () => void;
  /** Clears every row flagged as not real income or spending, such as a credit
   *  card bill payment. */
  rejectCardPayments: () => void;
  rejectTransaction: (id: string) => void;
  clearAll: () => void;
  /** Remembers the merchant a description names (see merchantKey), so every
   *  branch of it is filed under this category from now on. */
  learnRule: (description: string, categoryId: string) => void;
  removeRule: (description: string) => void;
}

/** Rows that can be filed without a person looking: not a possible duplicate,
 *  not a card payment, not held by an exclusion rule. */
function isPlainRow(tx: TriageTransaction): boolean {
  return !tx.duplicate && !tx.flag && !tx.exclusionMatches?.length
}

function validRules(state: Pick<TriageState, 'exclusionRules' | 'importSources'>) {
  return Object.entries(state.exclusionRules).filter(([id, rule]) =>
    rule?.id === id && rule.enabled === true && Number.isSafeInteger(rule.revision) && rule.revision >= 1 &&
    validateExclusionDraft(rule, state.importSources).length === 0).map(([, rule]) => rule);
}

function applyPendingRules(state: TriageState, exclusionRules = state.exclusionRules) {
  const eligible = Object.values(state.pendingTransactions).filter(tx => {
    const record = tx.importRecordId && state.importRecords[tx.importRecordId];
    return record && record.decision === 'pending' && !!state.importSources[record.sourceId];
  });
  const result = applyImportExclusions(eligible, state.importRecords, validRules({ ...state, exclusionRules }));
  const pendingTransactions = { ...state.pendingTransactions };
  for (const tx of eligible) delete pendingTransactions[tx.id];
  for (const tx of result.pending) pendingTransactions[tx.id] = tx;
  return { pendingTransactions, importRecords: result.records, excludedIds: result.excludedIds };
}

export function migrateTriageState(persisted: unknown, version: number) {
  const state = (persisted ?? {}) as Partial<TriageState>;
  return { ...state,
    ...(version < 2 ? { importSources: {}, importRecords: {}, importDays: [], lastImport: null } : {}),
    exclusionRules: state.exclusionRules ?? {},
  };
}

export const useTriageStore = create<TriageState>()(
  persist(
    (set, get) => {
      /** Moves rows into the budget in one write to each store, so filing a
       *  thousand rows costs one save instead of a thousand. Returns the ids
       *  that were added. */
      const fileRows = (rows: Array<{ tx: TriageTransaction; categoryId: string }>): string[] => {
        if (!rows.length) return [];
        const { categories, categoryGroups } = useBudgetStore.getState();
        const valid = rows.filter(({ tx, categoryId }) => {
          const filed = { ...tx, categoryId };
          return !tx.exclusionMatches?.length && hasValidPendingCategory(filed, categories, categoryGroups);
        });
        if (!valid.length) return [];
        useUndoStore.getState().dismissUndo();
        useBudgetStore.setState((budget) => {
          const transactions = { ...budget.transactions };
          for (const { tx, categoryId } of valid) {
            transactions[tx.id] = { id: tx.id, date: tx.date, amount: tx.amount, categoryId, description: tx.description, type: tx.type };
          }
          return { transactions };
        });
        set((state) => {
          const pendingTransactions = { ...state.pendingTransactions };
          const importRecords = { ...state.importRecords };
          for (const { tx } of valid) {
            delete pendingTransactions[tx.id];
            const record = tx.importRecordId && importRecords[tx.importRecordId];
            if (record) importRecords[record.id] = { ...record, decision: 'accepted' };
          }
          return { pendingTransactions, importRecords };
        });
        return valid.map(({ tx }) => tx.id);
      };

      return {
      pendingTransactions: {},
      categoryRules: {},
      exclusionRules: {},
      importSources: {},
      importRecords: {},
      importDays: [],
      lastImport: null,

      saveExclusionRule: (draft, options = {}) => {
        const state = get();
        const errors = validateExclusionDraft(draft, state.importSources);
        if (errors.length) throw new Error(errors[0]);
        const previous = options.id ? state.exclusionRules[options.id] : undefined;
        if (options.id && !previous) throw new Error('Choose an available exclusion rule');
        const revision = previous ? previous.revision + 1 : 1;
        if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Choose a valid rule revision');
        const id = options.id ?? uuidv4();
        const rule: ExclusionRule = { ...draft, name: draft.name.trim(),
          description: { ...draft.description }, amount: { ...draft.amount },
          id, revision, enabled: previous?.enabled ?? true };
        const exclusionRules = { ...state.exclusionRules, [id]: rule };
        const applied = options.applyPending ? applyPendingRules(state, exclusionRules) : undefined;
        useUndoStore.getState().dismissUndo();
        set({ exclusionRules, ...(applied ? { pendingTransactions: applied.pendingTransactions, importRecords: applied.importRecords } : {}) });
        return id;
      },

      setExclusionRuleEnabled: (id, enabled) => {
        const state = get(), rule = state.exclusionRules[id];
        if (!rule) return;
        if (enabled && (rule.id !== id || !Number.isSafeInteger(rule.revision) || rule.revision < 1 ||
          validateExclusionDraft(rule, state.importSources).length)) throw new Error('Choose a valid exclusion rule');
        useUndoStore.getState().dismissUndo();
        set({ exclusionRules: { ...state.exclusionRules, [id]: { ...rule, enabled } } });
      },

      deleteExclusionRule: (id) => {
        if (!get().exclusionRules[id]) return;
        useUndoStore.getState().dismissUndo();
        const exclusionRules = { ...get().exclusionRules };
        delete exclusionRules[id];
        set({ exclusionRules });
      },

      applyExclusionRulesToPending: () => {
        const applied = applyPendingRules(get());
        useUndoStore.getState().dismissUndo();
        set({ pendingTransactions: applied.pendingTransactions, importRecords: applied.importRecords });
        return applied.excludedIds;
      },

      includeExclusionMatch: (id) => {
        const state = get(), tx = state.pendingTransactions[id];
        const record = tx?.importRecordId ? state.importRecords[tx.importRecordId] : undefined;
        if (!tx || !record || !state.importSources[record.sourceId]) return;
        useUndoStore.getState().dismissUndo();
        set({ pendingTransactions: { ...state.pendingTransactions, [id]: { ...tx, exclusionMatches: undefined } },
          importRecords: { ...state.importRecords, [record.id]: { ...record, exclusionOverride: 'include', exclusionMatches: undefined } } });
      },

      excludeExclusionMatches: (ids) => {
        const state = get(), pendingTransactions = { ...state.pendingTransactions }, importRecords = { ...state.importRecords };
        const excludedIds: string[] = [];
        for (const id of new Set(ids)) {
          const tx = pendingTransactions[id], record = tx?.importRecordId ? importRecords[tx.importRecordId] : undefined;
          if (!tx?.exclusionMatches?.length || tx.duplicate || !record || record.decision !== 'pending') continue;
          delete pendingTransactions[id];
          importRecords[record.id] = { ...record, decision: 'ignored', ignoreReason: 'rule', exclusionMatches: tx.exclusionMatches };
          excludedIds.push(record.id);
        }
        useUndoStore.getState().dismissUndo();
        set({ pendingTransactions, importRecords });
        return excludedIds;
      },

      createImportSource: (name, bankKey) => {
        const existing = bankKey && Object.values(get().importSources).find(source => source.bankKey === bankKey);
        if (existing) return existing.id;
        if (!name.trim()) throw new Error('Enter a card or account name');
        const id = uuidv4();
        set(state => ({ importSources: { ...state.importSources, [id]: { id, name: name.trim(), bankKey } } }));
        return id;
      },

      bindImportSource: (sourceId, bankKey) => {
        const source = get().importSources[sourceId];
        if (!source || (source.bankKey && source.bankKey !== bankKey)) throw new Error('Choose the matching card or a new source');
        const conflict = Object.values(get().importSources).find(s => s.bankKey === bankKey && s.id !== sourceId);
        if (conflict) throw new Error('This card already has an import source');
        set(state => ({ importSources: { ...state.importSources, [sourceId]: { ...source, bankKey } } }));
      },

      importTransactions: (rows, sourceId) => {
        const state = get();
        if (!state.importSources[sourceId]) throw new Error('Choose a card or account');
        useUndoStore.getState().dismissUndo();
        const importedIds = new Set(Object.keys(state.importRecords));
        for (const record of Object.values(state.importRecords)) {
          if (record.matchedTransactionId) importedIds.add(record.matchedTransactionId);
        }
        const legacy = [
          ...Object.values(useBudgetStore.getState().transactions).filter(tx => !importedIds.has(tx.id)),
          ...Object.values(state.pendingTransactions).filter(tx => !tx.importRecordId),
        ];
        const result = matchImport(rows, sourceId, state.importRecords, state.importDays, legacy);
        const rules = validRules(state);
        const excluded = applyImportExclusions(result.pending, result.records, rules);
        const report = { ...result.report, excludedIds: excluded.excludedIds };
        set({
          pendingTransactions: { ...state.pendingTransactions, ...Object.fromEntries(excluded.pending.map(tx => [tx.id, tx])) },
          importRecords: excluded.records, importDays: result.days, lastImport: report,
        });
        // Rows from a merchant already categorized go straight into the
        // budget; only new merchants wait on the Categorize page.
        const newIds = new Set(excluded.pending.map(tx => tx.id));
        const autoAddedIds = get().addRuleMatches().filter(id => newIds.has(id));
        const finalReport = { ...report, autoAddedIds };
        set({ lastImport: finalReport, lastImportAt: new Date().toISOString().slice(0, 10) });
        return finalReport;
      },

      restoreImportRecord: (id) => {
        const state = get(), record = state.importRecords[id];
        if (!record || record.decision !== 'ignored') return;
        useUndoStore.getState().dismissUndo();
        set({ pendingTransactions: { ...state.pendingTransactions,
          [id]: { ...record.original, id, importRecordId: id, importSourceId: record.sourceId, exclusionMatches: undefined,
            duplicate: record.matchedRecordId || record.matchedTransactionId ? 'possible' : undefined,
            duplicateRecordId: record.matchedRecordId, duplicateTransactionId: record.matchedTransactionId } },
          importRecords: { ...state.importRecords, [id]: { ...record, decision: 'pending',
            exclusionOverride: 'include', exclusionMatches: undefined, ignoreReason: undefined,
            matchedRecordId: undefined, matchedTransactionId: undefined } } });
      },

      restoreAllExcluded: () => {
        const ids = Object.values(get().importRecords).filter((record) => record.decision === 'ignored').map((record) => record.id);
        if (!ids.length) return [];
        useUndoStore.getState().dismissUndo();
        // One write for the whole batch, the same shape restoreImportRecord writes.
        set((state) => {
          const pendingTransactions = { ...state.pendingTransactions };
          const importRecords = { ...state.importRecords };
          for (const id of ids) {
            const record = importRecords[id];
            pendingTransactions[id] = { ...record.original, id, importRecordId: id, importSourceId: record.sourceId, exclusionMatches: undefined,
              duplicate: record.matchedRecordId || record.matchedTransactionId ? 'possible' : undefined,
              duplicateRecordId: record.matchedRecordId, duplicateTransactionId: record.matchedTransactionId };
            importRecords[id] = { ...record, decision: 'pending', exclusionOverride: 'include', exclusionMatches: undefined,
              ignoreReason: undefined, matchedRecordId: undefined, matchedTransactionId: undefined };
          }
          return { pendingTransactions, importRecords };
        });
        return ids;
      },

      includeSetAside: () => {
        const ids = Object.values(get().pendingTransactions).filter((tx) => tx.flag && !tx.duplicate).map((tx) => tx.id);
        if (!ids.length) return [];
        useUndoStore.getState().dismissUndo();
        set((state) => {
          const pendingTransactions = { ...state.pendingTransactions };
          for (const id of ids) pendingTransactions[id] = { ...pendingTransactions[id], flag: undefined };
          return { pendingTransactions };
        });
        return ids;
      },

      resolveDuplicate: (id) => {
        const tx = get().pendingTransactions[id];
        if (!tx?.duplicate) return;
        useUndoStore.getState().dismissUndo();
        set(state => {
          const pendingTransactions = { ...state.pendingTransactions };
          delete pendingTransactions[id];
          const recordId = tx.importRecordId;
          const record = recordId && state.importRecords[recordId];
          return { pendingTransactions, importRecords: record ? { ...state.importRecords,
            [record.id]: { ...record, decision: 'duplicate', matchedRecordId: tx.duplicateRecordId, matchedTransactionId: tx.duplicateTransactionId },
          } : state.importRecords };
        });
      },

      learnRule: (description, categoryId) =>
        set((state) => ({
          categoryRules: { ...state.categoryRules, [merchantKey(description)]: categoryId },
        })),

      categorizeAndAdd: (ids, categoryId, options) => {
        const learn = options?.learn ?? true;
        const { categories, categoryGroups } = useBudgetStore.getState();
        const category = categories[categoryId];
        if (!category) return [];
        const kind = categoryGroups[category.groupId]?.kind;
        const pending = get().pendingTransactions;
        // A row whose direction does not fit the category (income into an
        // expense category) is left for the person to look at.
        const rows = ids.map((id) => pending[id]).filter((tx): tx is TriageTransaction => !!tx && tx.type === kind);
        const added = fileRows(rows.map((tx) => ({ tx, categoryId })));
        if (learn && rows[0] && added.length) {
          get().learnRule(rows[0].description, categoryId);
          added.push(...get().addRuleMatches());
        }
        return added;
      },

      addRuleMatches: () => {
        const { categories, categoryGroups } = useBudgetStore.getState();
        const rules = get().categoryRules;
        const matches: Array<{ tx: TriageTransaction; categoryId: string }> = [];
        for (const tx of Object.values(get().pendingTransactions)) {
          if (!isPlainRow(tx) || entryKindOf(tx) === 'refund-payment') continue;
          const categoryId = guessCategory(tx.description, categories, rules);
          const category = categoryId ? categories[categoryId] : undefined;
          if (!categoryId || !category || categoryGroups[category.groupId]?.kind !== tx.type) continue;
          matches.push({ tx, categoryId });
        }
        return fileRows(matches);
      },

      removeRule: (description) =>
        set((state) => {
          const newRules = { ...state.categoryRules };
          delete newRules[description];
          return { categoryRules: newRules };
        }),

      addPending: (transactions) => {
        useUndoStore.getState().dismissUndo();
        set((state) => {
          const newPending = { ...state.pendingTransactions };
          const importRecords = { ...state.importRecords };
          transactions.forEach((tx) => {
            newPending[tx.id] = tx;
            if (tx.importRecordId && tx.importSourceId) {
              const previous = importRecords[tx.importRecordId];
              importRecords[tx.importRecordId] = { ...previous, id: tx.importRecordId, sourceId: tx.importSourceId,
                original: previous?.original ?? { ...tx }, decision: 'pending',
                matchedRecordId: undefined, matchedTransactionId: undefined };
            }
          });
          return { pendingTransactions: newPending, importRecords };
        });
      },

      updatePending: (id, updates) => {
        if (!get().pendingTransactions[id]) return;
        useUndoStore.getState().dismissUndo();
        set((state) => ({
          pendingTransactions: {
            ...state.pendingTransactions,
            [id]: { ...state.pendingTransactions[id], ...updates },
          },
        }));
      },

      setPendingReceiptTreatment: (id, treatment) => {
        const tx = get().pendingTransactions[id];
        if (!tx || !(cashMovement(tx) > 0) || entryKindOf(tx) === treatment) return;
        if (!useBudgetStore.getState().refundsAndPaymentsEnabled &&
          entryKindOf(tx) !== 'refund-payment' && treatment === 'refund-payment') return;
        const amount = cashMovement(tx);
        get().updatePending(id, {
          type: treatment === 'income' ? 'income' : 'expense',
          amount: treatment === 'income' ? amount : -amount,
          categoryId: undefined,
        });
      },

      approveTransaction: (id, options) => {
        const learn = options?.learn ?? true;
        const state = get();
        const tx = state.pendingTransactions[id];
        if (!tx || tx.exclusionMatches?.length || !hasValidPendingCategory(tx, useBudgetStore.getState().categories, useBudgetStore.getState().categoryGroups)) return;
        useUndoStore.getState().dismissUndo();
        
        // Push to main budget store
        useBudgetStore.getState().addTransaction({
          id: tx.id,
          date: tx.date,
          amount: tx.amount,
          categoryId: tx.categoryId || '',
          description: tx.description,
          type: tx.type,
        });

        // Learn the rule if a category is assigned
        if (learn && tx.categoryId && entryKindOf(tx) !== 'refund-payment') {
          state.learnRule(tx.description, tx.categoryId);
        }

        // Remove from triage
        set((state) => {
          const newPending = { ...state.pendingTransactions };
          delete newPending[id];
          const record = tx.importRecordId && state.importRecords[tx.importRecordId];
          return { pendingTransactions: newPending, importRecords: record ? {
            ...state.importRecords, [record.id]: { ...record, decision: 'accepted' },
          } : state.importRecords };
        });
      },

      approveAll: () => {
        useUndoStore.getState().dismissUndo();
        const state = get();
        const budgetState = useBudgetStore.getState();
        const txs = Object.values(state.pendingTransactions).filter((tx) => !tx.duplicate && !tx.flag && !tx.exclusionMatches?.length && hasValidPendingCategory(tx, budgetState.categories, budgetState.categoryGroups));

        txs.forEach((tx) => {
          budgetState.addTransaction({
            id: tx.id,
            date: tx.date,
            amount: tx.amount,
            categoryId: tx.categoryId || '',
            description: tx.description,
            type: tx.type,
          });

          if (tx.categoryId && entryKindOf(tx) !== 'refund-payment') {
            state.learnRule(tx.description, tx.categoryId);
          }
        });

        const approvedIds = txs.map((tx) => tx.id);
        set((current) => {
          const newPending = { ...current.pendingTransactions };
          const importRecords = { ...current.importRecords };
          for (const id of approvedIds) delete newPending[id];
          for (const tx of txs) {
            const record = tx.importRecordId && importRecords[tx.importRecordId];
            if (record) importRecords[record.id] = { ...record, decision: 'accepted' };
          }
          return { pendingTransactions: newPending, importRecords };
        });
        return approvedIds;
      },

      rejectDuplicates: () => {
        for (const tx of Object.values(get().pendingTransactions).filter(tx => tx.duplicate)) get().resolveDuplicate(tx.id);
      },

      rejectCardPayments: () => {
        for (const tx of Object.values(get().pendingTransactions).filter(tx => tx.flag === 'card-payment')) get().rejectTransaction(tx.id);
      },

      rejectTransaction: (id) => {
        useUndoStore.getState().dismissUndo();
        set((state) => {
          const newPending = { ...state.pendingTransactions };
          const tx = newPending[id];
          delete newPending[id];
          const record = tx?.importRecordId && state.importRecords[tx.importRecordId];
          return { pendingTransactions: newPending, importRecords: record ? {
            ...state.importRecords, [record.id]: { ...record, decision: 'ignored',
              exclusionMatches: tx.exclusionMatches,
              matchedRecordId: tx.duplicateRecordId, matchedTransactionId: tx.duplicateTransactionId,
              ignoreReason: tx.exclusionMatches?.length ? 'rule' : tx.flag === 'card-payment' ? 'card-payment' : 'manual' },
          } : state.importRecords };
        });
      },

      clearAll: () => {
        useUndoStore.getState().dismissUndo();
        set(state => {
        const cancelled = new Set(Object.values(state.pendingTransactions).map(tx => tx.importRecordId).filter(Boolean));
        const cancelledTransactions = new Set(Object.keys(state.pendingTransactions));
        // Duplicate decisions are only meaningful while their original survives.
        // Invalidate dependent decisions too, including a chain of matches.
        let changed = true;
        while (changed) {
          changed = false;
          for (const record of Object.values(state.importRecords)) {
            if (!cancelled.has(record.id) && record.decision === 'duplicate' &&
              ((record.matchedRecordId && cancelled.has(record.matchedRecordId)) ||
                (record.matchedTransactionId && cancelledTransactions.has(record.matchedTransactionId)))) {
              cancelled.add(record.id);
              changed = true;
            }
          }
        }
        return { pendingTransactions: {},
          importRecords: Object.fromEntries(Object.entries(state.importRecords).filter(([id]) => !cancelled.has(id))),
          importDays: state.importDays.filter(day => day.recordIds.every(id => !cancelled.has(id))),
          lastImport: null,
        };
        });
      },
      };
    },
    {
      name: STORAGE_KEYS.triage,
      version: 3,
      migrate: migrateTriageState,
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<TriageState>) };
        state.exclusionRules = Object.fromEntries(Object.entries(state.exclusionRules ?? {}).map(([id, rule]) => {
          const valid = rule && typeof rule === 'object' && rule.id === id &&
            Number.isSafeInteger(rule.revision) && rule.revision >= 1 && typeof rule.enabled === 'boolean' &&
            validateExclusionDraft(rule, state.importSources).length === 0;
          return [id, valid ? rule : { ...rule, enabled: false }];
        }));
        return state;
      },
    }
  )
);
