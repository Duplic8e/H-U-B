import type { TickerMap } from './types'

/** One positional row from an IBKR activity-statement CSV. */
export type RawRow = (string | number)[]

function normalizeNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const n = parseFloat(String(val).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function isTradeRow(row: RawRow): boolean {
  return row[0] === 'Trades' && row[1] === 'Data' && row[2] === 'Order' &&
    (row[3] === 'Equity and Index Options' || row[3] === 'Stocks')
}

function isOpenPositionRow(row: RawRow): boolean {
  return row[0] === 'Open Positions' && row[1] === 'Data' && row[2] === 'Summary' &&
    (row[3] === 'Equity and Index Options' || row[3] === 'Stocks')
}

/** Merge a new upload's rows into the stored rows: trades are deduped by a
 *  deterministic hash; Open Positions snapshots come ONLY from the new
 *  upload (the previous snapshot is discarded so closed wheels close). */
export function mergeActivityRows(existingRows: RawRow[], newRows: RawRow[]): RawRow[] {
  const uniqueTrades = new Map<string, RawRow>()
  for (const row of [...existingRows, ...newRows]) {
    if (!row || row.length < 12) continue
    if (isTradeRow(row)) {
      const hash = `${row[0]}_${row[3]}_${row[5]}_${row[6]}_${row[7]}_${row[8]}_${row[10]}`
      uniqueTrades.set(hash, row)
    }
  }
  const latestOpenPositions = newRows.filter((row) => row && row.length >= 12 && isOpenPositionRow(row))
  return [...uniqueTrades.values(), ...latestOpenPositions]
}

/** Rebuild per-ticker wheel state from raw activity rows. Faithful port of
 *  the standalone wheel tracker's csvParser. */
/** Rows from the Trades and Open Positions sections carry the instrument's
 *  currency in column 4. The first one seen for a ticker wins. */
function noteCurrency(state: { currency?: string }, row: RawRow) {
  const code = String(row[4] ?? '').trim()
  if (!state.currency && /^[A-Z]{3}$/.test(code)) state.currency = code
}

export function processIBKR(rows: RawRow[]): TickerMap {
  const stateTickers: TickerMap = {}

  function initTicker(ticker: string) {
    if (!stateTickers[ticker]) {
      stateTickers[ticker] = {
        ticker,
        premiumCollected: 0,
        opSharesHeld: 0,
        displayCost: 0,
        displayRealized: 0,
        currentPrice: 0,
        marketValue: 0,
        openPutContracts: 0,
        openPutStrikeSum: 0,
        hasOpenPosition: false,
        history: [],
      }
    }
  }

  // Temporary storage for chronologically reconstructing raw equity cost
  const stockTrades: Record<string, Array<{ date: string; q: number; cashFlow: number }>> = {}
  const opCostBasisMap: Record<string, number> = {}

  rows.forEach((row) => {
    if (!row || row.length < 12) return

    // 1A. Options premium history
    if (row[0] === 'Trades' && row[1] === 'Data' && row[2] === 'Order' && row[3] === 'Equity and Index Options') {
      const optionString = String(row[5] ?? '')
      if (!optionString) return

      const baseTicker = optionString.split(' ')[0]
      initTicker(baseTicker)
      noteCurrency(stateTickers[baseTicker], row)

      const proceeds = normalizeNumber(row[10])
      const commFee = normalizeNumber(row[11])
      stateTickers[baseTicker].premiumCollected += proceeds + commFee

      stateTickers[baseTicker].history.push({
        date: String(row[6]),
        ticker: baseTicker,
        type: 'Option',
        action: 'Trade',
        quantity: normalizeNumber(row[7]),
        price: normalizeNumber(row[8]),
        proceeds,
        commFee,
        description: optionString,
      })
    }

    // 1B. Stock trade history (for raw equity cost reconstruction)
    if (row[0] === 'Trades' && row[1] === 'Data' && row[2] === 'Order' && row[3] === 'Stocks') {
      const baseTicker = String(row[5] ?? '')
      if (!baseTicker) return

      initTicker(baseTicker)
      noteCurrency(stateTickers[baseTicker], row)
      if (!stockTrades[baseTicker]) stockTrades[baseTicker] = []

      const qty = normalizeNumber(row[7])
      const proceeds = normalizeNumber(row[10])
      const commFee = normalizeNumber(row[11])

      stockTrades[baseTicker].push({ date: String(row[6]), q: qty, cashFlow: proceeds + commFee })

      stateTickers[baseTicker].history.push({
        date: String(row[6]),
        ticker: baseTicker,
        type: 'Equity',
        action: 'Trade',
        quantity: qty,
        price: normalizeNumber(row[8]),
        proceeds,
        commFee,
        description: baseTicker + ' Equity',
      })
    }

    // 2A. Current stock holdings (open positions)
    if (row[0] === 'Open Positions' && row[1] === 'Data' && row[2] === 'Summary' && row[3] === 'Stocks') {
      const baseTicker = String(row[5] ?? '')
      if (!baseTicker) return

      initTicker(baseTicker)
      noteCurrency(stateTickers[baseTicker], row)
      stateTickers[baseTicker].opSharesHeld = normalizeNumber(row[6])
      opCostBasisMap[baseTicker] = normalizeNumber(row[9])
      stateTickers[baseTicker].currentPrice = normalizeNumber(row[10])
      stateTickers[baseTicker].marketValue = normalizeNumber(row[11])
    }

    // 2B. Mark-to-market performance summary for holdings
    if (typeof row[0] === 'string' && row[0].startsWith('Mark-to-Mar') && row[1] === 'Data' && row[2] === 'Stocks') {
      const baseTicker = String(row[3] ?? '')
      if (!baseTicker) return

      initTicker(baseTicker)
      const currentQuantity = normalizeNumber(row[5])
      if (currentQuantity > 0) {
        stateTickers[baseTicker].opSharesHeld = currentQuantity
        stateTickers[baseTicker].currentPrice = normalizeNumber(row[7])
        stateTickers[baseTicker].marketValue = currentQuantity * stateTickers[baseTicker].currentPrice
      }
    }

    // 2C. Open option positions (put obligations)
    if (row[0] === 'Open Positions' && row[1] === 'Data' && row[2] === 'Summary' && row[3] === 'Equity and Index Options') {
      const optionString = String(row[5] ?? '')
      if (!optionString) return

      const baseTicker = optionString.split(' ')[0]
      initTicker(baseTicker)
      noteCurrency(stateTickers[baseTicker], row)

      const qty = normalizeNumber(row[6])
      if (qty !== 0) stateTickers[baseTicker].hasOpenPosition = true

      const parts = optionString.split(' ')
      if (parts.length >= 4) {
        const strike = parseFloat(parts[2])
        const type = parts[3].toUpperCase()
        if (type === 'P' && qty < 0) {
          stateTickers[baseTicker].openPutContracts += Math.abs(qty)
          stateTickers[baseTicker].openPutStrikeSum += strike * Math.abs(qty)
        }
      }
    }
  })

  // Finalize raw cost reconstruction (average-cost method over sorted trades)
  Object.keys(stateTickers).forEach((ticker) => {
    const d = stateTickers[ticker]
    const trades = stockTrades[ticker] || []
    trades.sort((a, b) => a.date.localeCompare(b.date))

    let shares = 0
    let rawCost = 0
    let realizedPL = 0

    trades.forEach((trade) => {
      if (trade.q > 0) {
        shares += trade.q
        rawCost += -trade.cashFlow
      } else if (trade.q < 0) {
        const soldShares = Math.abs(trade.q)
        const avgCost = shares > 0 ? rawCost / shares : 0
        rawCost -= soldShares * avgCost
        shares += trade.q
        realizedPL += trade.cashFlow - soldShares * avgCost
      }
    })

    // If the snapshot rows had no share count but trade history says we
    // still hold shares, trust the reconstruction.
    if (d.opSharesHeld === 0 && shares > 0) {
      d.opSharesHeld = shares
    }

    if (Math.abs(shares - d.opSharesHeld) < 0.01) {
      d.displayCost = rawCost
      d.displayRealized = realizedPL
    } else {
      d.displayCost = opCostBasisMap[ticker] || 0
      d.displayRealized = realizedPL
    }

    if (d.opSharesHeld > 0 || d.openPutContracts > 0) {
      d.hasOpenPosition = true
    }
  })

  return stateTickers
}
