import type { ExclusionMatch } from './exclusionRules'

export interface TriageTransaction {
  exclusionMatches?: ExclusionMatch[];
  id: string; // Temporary UUID for triage
  date: string; // YYYY-MM-DD
  amount: number; // Positive income/purchase; negative expense for an incoming refund or payment
  categoryId?: string; // Guessed or selected category
  description: string;
  type: 'expense' | 'income';
  originalRowData?: Record<string, string>; // The raw CSV row
  bankSource?: { key: string; name: string };
  importRecordId?: string;
  importSourceId?: string;
  duplicateRecordId?: string;
  duplicateTransactionId?: string;
  /** Set at import time when this row looks like something already in the
   *  budget. 'exact' means same date, amount, direction and description;
   *  'possible' means same date, amount and direction only. */
  duplicate?: 'exact' | 'possible';
  /** Set at import time for rows that are not real income or spending, such as
   *  a credit card bill payment. Flagged rows are held back from bulk accept. */
  flag?: 'card-payment';
}

export interface BankParserConfig {
  name: string;
  // Function to detect if a CSV matches this parser based on header names
  detect: (headers: string[]) => boolean;
  // Function to map a raw row into the base fields of a TriageTransaction
  parse: (row: Record<string, string>) => Omit<TriageTransaction, 'id' | 'categoryId'> | null;
}
