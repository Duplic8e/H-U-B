import type { Transaction } from '../../types/budget'
import type { TriageTransaction } from '../../types/triage'

export type DuplicateVerdict = 'exact' | 'possible'

/** Bank exports vary in case, spacing and punctuation for the same merchant, so
 *  descriptions are compared on letters and digits only. */
export function normalizeDescription(d: string): string {
  return d.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function looseKey(tx: { date: string; amount: number; type: string }): string {
  return `${tx.date}|${tx.amount.toFixed(2)}|${tx.type}`
}

function tightKey(tx: { date: string; amount: number; type: string; description: string }): string {
  return `${looseKey(tx)}|${normalizeDescription(tx.description)}`
}

/** Which incoming rows already look present.
 *
 *  A row is 'exact' when date, amount, direction and normalized description all
 *  match something already in the budget; 'possible' when only date, amount and
 *  direction match, which catches the same charge described differently by two
 *  statement exports. Rows earlier in the same file count as already present, so
 *  a file that repeats a row flags the repeat rather than the original. */
export function classifyDuplicates(
  incoming: TriageTransaction[],
  existing: Transaction[],
): Record<string, DuplicateVerdict> {
  const tight = new Set(existing.map(tightKey))
  const loose = new Set(existing.map(looseKey))
  const verdicts: Record<string, DuplicateVerdict> = {}

  for (const tx of incoming) {
    if (tight.has(tightKey(tx))) verdicts[tx.id] = 'exact'
    else if (loose.has(looseKey(tx))) verdicts[tx.id] = 'possible'
    tight.add(tightKey(tx))
    loose.add(looseKey(tx))
  }
  return verdicts
}
