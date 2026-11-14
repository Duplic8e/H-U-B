export type BudgetingParadigm = 'Ledger Custom' | 'Zero-Based' | 'Target-Based' | '50/30/20';

export type BudgetClass = 'need' | 'want' | 'savings';

export type BudgetCadence = 'monthly' | 'annual';

export interface CategoryGroup {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  /** 50/30/20 bucket for expense groups. Unclassified counts as need. */
  budgetClass?: BudgetClass;
}

export interface Category {
  id: string;
  groupId: string;
  name: string;
  targetAmount: number;
  /** Period targetAmount covers. Absent means 'monthly', so no migration is
   *  needed for categories saved before cadence existed. */
  cadence?: BudgetCadence;
  /** Whether spending here is one payment (a bill) or spread out. Absent means 'auto': treated as a bill when
   *  nearly all of it is monthly recurring payments. */
  billing?: 'auto' | 'bill' | 'everyday';
}

/** One slice of a split transaction. Stored slices have the same sign as the
 *  canonical parent transaction; form values are positive magnitudes. */
export interface TransactionSplit {
  categoryId?: string;
  amount: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  categoryId?: string;
  description: string;
  type: 'expense' | 'income';
  /** Shared bill: amount is YOUR share; totalAmount is what you actually paid.
   *  The difference is owed to you by sharedWith. */
  shared?: { totalAmount: number; sharedWith: string };
  /** Income that pays back a shared bill; excluded from income totals. */
  reimbursement?: { from: string };
  /** Category slices. When present the parent categoryId is only used for any
   *  amount the splits do not cover. Absent means the whole amount belongs to
   *  categoryId, which is how every transaction written before 0.9 behaves. */
  splits?: TransactionSplit[];
  /** Free-form labels, lower-cased and de-duplicated on save. */
  tags?: string[];
  /** Free text the user attached to this transaction. */
  note?: string;
}

export interface Reallocation {
  id: string;
  fromCategoryId: string;
  toCategoryId: string;
  amount: number;
  date: string;
  note?: string;
}
