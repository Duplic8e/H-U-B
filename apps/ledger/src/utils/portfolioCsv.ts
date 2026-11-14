// Broker CSV → holdings, following the src/utils/csvParser.ts pattern:
// named parser configs with detect(headers) + parse(row), plus an
// "unrecognized" result that the UI resolves with a generic column mapper.
// Broker export formats drift - the named parsers cover the common IBKR
// and Wealthsimple holdings exports; the mapper is the guaranteed path.

import Papa from 'papaparse'
import type { Holding } from '../store/usePortfolioStore'
import { CURRENCIES, type Currency } from '../services/marketData/types'

export interface UnrecognizedPortfolioCSV {
  unrecognized: true
  headers: string[]
  rows: Record<string, string>[]
}

export interface PortfolioParserConfig {
  name: string
  detect: (headers: string[]) => boolean
  parse: (row: Record<string, string>) => Omit<Holding, 'id' | 'account'> | null
}

/** The broker's currency code when we support it, else null. Never guesses:
 *  a wrong guess silently values a foreign position at par against CAD. */
export function toCurrency(raw: string | undefined): Currency | null {
  const code = raw?.trim().toUpperCase()
  if (!code) return null
  return (CURRENCIES as readonly string[]).includes(code) ? (code as Currency) : null
}

function positive(raw: string | undefined): number | null {
  const n = parseFloat(String(raw ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Case-insensitive row lookup; header keys are already BOM-stripped and
 *  trimmed by the transformHeader in parsePortfolioText. */
function cell(row: Record<string, string>, name: string): string | undefined {
  if (row[name] !== undefined) return row[name]
  const target = name.toLowerCase()
  const key = Object.keys(row).find((k) => k.toLowerCase() === target)
  return key !== undefined ? row[key] : undefined
}

function hasHeader(headers: string[], name: string): boolean {
  const target = name.toLowerCase()
  return headers.some((h) => h.toLowerCase() === target)
}

export const PORTFOLIO_PARSERS: PortfolioParserConfig[] = [
  {
    name: 'Interactive Brokers',
    detect: (headers) => hasHeader(headers, 'Symbol') && hasHeader(headers, 'Cost Basis'),
    parse: (row) => {
      const quantity = positive(cell(row, 'Quantity'))
      const costBasis = positive(cell(row, 'Cost Basis'))
      const ticker = cell(row, 'Symbol')?.trim()
      if (!ticker || quantity === null || costBasis === null) return null
      return {
        ticker: ticker.toUpperCase(),
        name: cell(row, 'Description')?.trim() || undefined,
        quantity,
        avgCost: costBasis / quantity,
        currency: toCurrency(cell(row, 'Currency')),
      }
    },
  },
  {
    name: 'Wealthsimple',
    detect: (headers) => hasHeader(headers, 'Symbol') && hasHeader(headers, 'Book Value'),
    parse: (row) => {
      const quantity = positive(cell(row, 'Quantity'))
      const bookValue = positive(cell(row, 'Book Value'))
      const ticker = cell(row, 'Symbol')?.trim()
      if (!ticker || quantity === null || bookValue === null) return null
      return {
        ticker: ticker.toUpperCase(),
        name: cell(row, 'Name')?.trim() || undefined,
        quantity,
        avgCost: bookValue / quantity,
        currency: toCurrency(cell(row, 'Currency')),
      }
    },
  },
]

export function parsePortfolioText(
  text: string,
): Omit<Holding, 'id' | 'account'>[] | UnrecognizedPortfolioCSV {
  const results = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
  })
  const headers = results.meta.fields ?? []
  const parser = PORTFOLIO_PARSERS.find((p) => p.detect(headers))
  if (!parser) return { unrecognized: true, headers, rows: results.data }
  const holdings: Omit<Holding, 'id' | 'account'>[] = []
  for (const row of results.data) {
    const parsed = parser.parse(row)
    if (parsed) holdings.push(parsed)
  }
  return holdings
}

export async function parsePortfolioCSV(
  file: File,
): Promise<Omit<Holding, 'id' | 'account'>[] | UnrecognizedPortfolioCSV> {
  return parsePortfolioText(await file.text())
}

export interface ColumnMapping {
  ticker: string
  quantity: string
  totalCost: string
  currency?: string
}

export function mapPortfolioRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): Omit<Holding, 'id' | 'account'>[] {
  const holdings: Omit<Holding, 'id' | 'account'>[] = []
  for (const row of rows) {
    const ticker = row[mapping.ticker]?.trim()
    const quantity = positive(row[mapping.quantity])
    const totalCost = positive(row[mapping.totalCost])
    if (!ticker || quantity === null || totalCost === null) continue
    holdings.push({
      ticker: ticker.toUpperCase(),
      quantity,
      avgCost: totalCost / quantity,
      currency: toCurrency(mapping.currency ? row[mapping.currency] : undefined),
    })
  }
  return holdings
}
