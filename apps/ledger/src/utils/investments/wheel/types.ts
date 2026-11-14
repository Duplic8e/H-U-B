export interface TradeRecord {
  date: string
  ticker: string
  type: 'Option' | 'Equity'
  action: string
  quantity: number
  price: number
  proceeds: number
  commFee: number
  description: string
  // Option specific
  strike?: number
  expiry?: string
  callPut?: 'C' | 'P'
}

export interface TickerState {
  ticker: string

  /** ISO currency code from the statement's Currency column, when the rows carry one. */
  currency?: string

  // Stock tracking
  opSharesHeld: number
  displayCost: number // Raw equity cost, or IBKR cost-basis fallback
  displayRealized: number // IBKR realized P/L for equity
  currentPrice: number // Spot price parsed from the statement
  marketValue: number // shares * currentPrice

  // Option tracking
  openPutContracts: number
  openPutStrikeSum: number
  premiumCollected: number

  // True when opSharesHeld > 0 OR open option contracts exist
  hasOpenPosition: boolean

  history: TradeRecord[]
}

export type TickerMap = Record<string, TickerState>
