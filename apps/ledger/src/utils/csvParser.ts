import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import type { TriageTransaction } from '../types/triage';

/** One parsed CSV record. PapaParse gives an object keyed by header when the
 *  file has headers, and a positional string array when it does not. */
/** Chase escapes a handful of characters in merchant names, so `H&M` arrives as
 *  `H&amp;M`. Only the entities Chase actually emits are handled; this is
 *  deliberately not a general HTML parser. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export type CsvRow = Record<string, string>
export type CsvHeaderlessRow = string[]

export interface UnrecognizedCSVResult {
  unrecognized: true;
  headers: string[];
  rows: (CsvRow | CsvHeaderlessRow)[];
}

export interface BankParserConfig {
  name: string;
  detect: (headers: string[], firstRow: CsvRow | CsvHeaderlessRow | undefined) => boolean;
  parse: (row: CsvRow | CsvHeaderlessRow) => Omit<TriageTransaction, 'id' | 'categoryId'> | null;
}

export const PARSERS: BankParserConfig[] = [
  {
    name: 'CIBC Credit Card (Headerless)',
    // Date, Description, Debit, Credit, Masked Card Number (no header row).
    detect: (_headers, firstRow) => Array.isArray(firstRow) && firstRow.length === 5 &&
      /^\d{4}-\d{2}-\d{2}$/.test(firstRow[0].trim()) && /^\d{4}\*+\d{4}$/.test(firstRow[4].trim()),
    parse: (row) => {
      if (!Array.isArray(row) || row.length !== 5) throw new Error('Expected five columns');
      const [date, description, debit, credit, card] = row.map(value => value.trim());
      const parsedDate = new Date(`${date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
      if (!description || !/^\d{4}\*+\d{4}$/.test(card)) throw new Error('Invalid description or masked card number');
      if (Boolean(debit) === Boolean(credit)) throw new Error('Expected exactly one debit or credit amount');
      const amountText = debit || credit;
      const amount = Number(amountText);
      if (!/^\d+(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount)) throw new Error('Invalid amount');
      const originalRowData = Object.fromEntries(row.map((value, i) => [String(i), value]));
      const bankSource = { key: `cibc:${card.slice(0, 4)}:${card.slice(-4)}`, name: `CIBC card ${card.slice(-4)}` };
      // Card payments are transfers; other credits return money to spending.
      const isPayment = /^(?:PAYMENT THANK YOU(?:\/.*)?|PRE AUTHORIZED PAYMENT - THANK YOU)$/i
        .test(description.replace(/\s+/g, ' '));
      if (credit && isPayment) {
        return { date, description, amount, type: 'income', flag: 'card-payment', originalRowData, bankSource };
      }
      return { date, description, amount: debit ? amount : -amount, type: 'expense', originalRowData, bankSource };
    },
  },
  {
    name: 'Preferred Package',
    // Headers: Filter,Date,Description,Sub-description,Type of Transaction,Amount,Balance
    detect: (headers) => headers.includes('Sub-description') && headers.includes('Type of Transaction'),
    parse: (row) => {
      if (Array.isArray(row)) return null;
      const amountRaw = parseFloat(row['Amount']);
      if (isNaN(amountRaw)) return null;

      const type = row['Type of Transaction'] === 'Credit' ? 'income' : 'expense';
      const amount = Math.abs(amountRaw);
      
      // Date is already YYYY-MM-DD in the example
      const date = row['Date'];
      
      // Combine Description and Sub-description
      const desc1 = row['Description']?.trim() || '';
      const desc2 = row['Sub-description']?.trim() || '';
      const description = [desc1, desc2].filter(Boolean).join(' - ');

      return { date, amount, description, type, originalRowData: row };
    }
  },
  {
    name: 'Account Activity (Headerless)',
    // It's headerless, so PapaParse gives us an array of strings for each row
    detect: (_headers, firstRow) => {
      // If it's headerless, firstRow is an array
      if (!Array.isArray(firstRow)) return false;
      // Check if first element is a date like MM/DD/YYYY
      return /^\d{2}\/\d{2}\/\d{4}$/.test(firstRow[0]);
    },
    parse: (row) => {
      if (!Array.isArray(row) || row.length < 5) return null;
      
      // row[0]: Date, row[1]: Description, row[2]: Expense, row[3]: Income
      let date = row[0];
      if (date && date.includes('/')) {
        const [m, d, y] = date.split('/');
        date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      const expense = parseFloat(row[2]);
      const income = parseFloat(row[3]);

      let amount: number;
      let type: 'income' | 'expense';

      if (!isNaN(expense)) {
        amount = expense;
        type = 'expense';
      } else if (!isNaN(income)) {
        amount = income;
        type = 'income';
      } else {
        return null;
      }

      // Convert array row to Record<string, string> to satisfy TriageTransaction types
      const originalRowData = Object.fromEntries(row.map((val, i) => [String(i), val]));

      return { date, amount, description: row[1]?.trim() || 'Unknown', type, originalRowData };
    }
  },
  {
    name: 'Download Transactions (Visa)',
    // Headers: Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$
    detect: (headers) => headers.includes('Transaction Date') && headers.includes('CAD$'),
    parse: (row) => {
      if (Array.isArray(row)) return null;
      const amountRaw = parseFloat(row['CAD$']);
      if (isNaN(amountRaw)) return null;
      
      // Negative is expense, positive is income
      const type = amountRaw > 0 ? 'income' : 'expense';
      const amount = Math.abs(amountRaw);
      
      let date = row['Transaction Date'];
      if (date && date.includes('/')) {
        const [m, d, y] = date.split('/');
        date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      return { date, amount, description: row['Description 1']?.trim() || 'Unknown', type, originalRowData: row };
    }
  },
  {
    name: 'Chase Credit Card',
    // Headers: Transaction Date,Post Date,Description,Category,Type,Amount,Memo
    detect: (headers) =>
      headers.includes('Transaction Date') && headers.includes('Post Date') && headers.includes('Type'),
    parse: (row) => {
      if (Array.isArray(row)) return null;
      const amountRaw = parseFloat(row['Amount']);
      if (isNaN(amountRaw)) return null;

      let date = row['Transaction Date'];
      if (date && date.includes('/')) {
        const [m, d, y] = date.split('/');
        date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      const description = decodeEntities(row['Description']?.trim() || 'Unknown');
      const chaseType = row['Type'];

      // A card bill payment is a transfer between the user's own accounts, so it
      // is flagged rather than counted as earnings. A refund is money returning
      // to the category it left, so it is a negative expense rather than income.
      if (chaseType === 'Payment') {
        return {
          date,
          amount: Math.abs(amountRaw),
          description,
          type: 'income' as const,
          flag: 'card-payment' as const,
          originalRowData: row,
        };
      }
      if (chaseType === 'Return') {
        return { date, amount: -Math.abs(amountRaw), description, type: 'expense' as const, originalRowData: row };
      }

      return {
        date,
        amount: Math.abs(amountRaw),
        description,
        type: amountRaw > 0 ? ('income' as const) : ('expense' as const),
        originalRowData: row,
      };
    }
  },
  {
    name: 'CIBC Bank Account (Headerless)',
    // CIBC chequing and savings downloads: Date, Description, Debit, Credit,
    // with no header row and no account number.
    detect: (_headers, firstRow) => Array.isArray(firstRow) && firstRow.length === 4 &&
      /^\d{4}-\d{2}-\d{2}$/.test(firstRow[0].trim()) &&
      (firstRow[2].trim() === '') !== (firstRow[3].trim() === ''),
    parse: (row) => {
      if (!Array.isArray(row) || row.length !== 4) throw new Error('Expected four columns');
      const [date, description, debit, credit] = row.map(value => value.trim());
      const parsedDate = new Date(`${date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
      if (!description) throw new Error('Missing description');
      if (Boolean(debit) === Boolean(credit)) throw new Error('Expected exactly one debit or credit amount');
      const amountText = debit || credit;
      const amount = Number(amountText);
      if (!/^\d+(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount)) throw new Error('Invalid amount');
      const originalRowData = Object.fromEntries(row.map((value, i) => [String(i), value]));
      const text = description.replace(/\s+/g, ' ');
      // Money moved between your own accounts, or to your credit card, is not
      // spending or income: both sides of it are in your other downloads.
      if (/\bINTERNET TRANSFER\b/i.test(text)) {
        return { date, description, amount, type: debit ? 'expense' : 'income', flag: 'card-payment', originalRowData };
      }
      // A refund, reversal or correction gives money back to that store's spending.
      if (credit && /\b(?:REVERSAL|RET REV|CORRECTION|REFUND)\b/i.test(text)) {
        return { date, description, amount: -amount, type: 'expense', originalRowData };
      }
      return { date, description, amount, type: debit ? 'expense' : 'income', originalRowData };
    },
  },
  {
    name: 'Standard Ledger CSV',
    detect: (headers) => headers.includes('Date') && headers.includes('Amount') && headers.includes('Description'),
    parse: (row) => {
      if (Array.isArray(row)) return null;
      const amountRaw = parseFloat(row['Amount']);
      if (isNaN(amountRaw)) return null;

      const type = amountRaw >= 0 ? 'income' : 'expense';
      const amount = Math.abs(amountRaw);
      
      return {
        date: row['Date'],
        amount,
        description: row['Description'],
        type,
        originalRowData: row
      };
    }
  }
];

export async function parseCSV(file: File): Promise<TriageTransaction[] | UnrecognizedCSVResult> {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  const firstLine = text.split('\n')[0].trim();
  
  // Bank exports may start with either MM/DD/YYYY or an ISO date.
  const isHeaderless = /^(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}),/.test(firstLine);

  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow | CsvHeaderlessRow>(text, {
      header: !isHeaderless,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = isHeaderless ? [] : (results.meta.fields || []);
        const firstRow = results.data[0];
        
        const parser = PARSERS.find(p => p.detect(headers, firstRow));
        
        if (!parser) {
          resolve({
            unrecognized: true,
            headers: isHeaderless ? (firstRow as CsvHeaderlessRow).map((_, i) => `Column ${i + 1}`) : headers,
            rows: results.data
          });
          return;
        }

        if ((parser.name === 'CIBC Credit Card (Headerless)' || parser.name === 'CIBC Bank Account (Headerless)') && results.errors.length) {
          reject(new Error('Invalid CIBC CSV: check the quoted fields and column separators.'));
          return;
        }
        const transactions: TriageTransaction[] = [];
        for (const [index, row] of results.data.entries()) {
          try {
            const parsed = parser.parse(row);
            if (parsed) {
              transactions.push({ ...parsed, id: uuidv4() });
            }
          } catch (error) {
            reject(new Error(`Invalid ${parser.name} row ${index + 1}: ${error instanceof Error ? error.message : 'Unable to parse transaction'}`));
            return;
          }
        }
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(error);
      }
    });
  });
}
