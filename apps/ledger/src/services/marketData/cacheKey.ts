export function quoteKey(ticker: string, exchange?: string): string {
  const t = ticker.trim().toUpperCase()
  const ex = exchange?.trim().toUpperCase()
  return ex ? `${ex}:${t}` : t
}

export function historicalKey(ticker: string, exchange: string | undefined, dateKey: string): string {
  return `${quoteKey(ticker, exchange)}@${dateKey}`
}

export function fxKey(from: string, to: string, dateKey: string): string {
  return `${from.trim().toUpperCase()}-${to.trim().toUpperCase()}@${dateKey}`
}
