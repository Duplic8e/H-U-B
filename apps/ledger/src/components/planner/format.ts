export function formatMoney(n: number): string {
  const roundedAbs = Math.round(Math.abs(n))
  const abs = roundedAbs.toLocaleString('en-CA')
  return `${n < 0 && roundedAbs !== 0 ? '-' : ''}$${abs}`
}

export function formatMoneyWithCents(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return `${rounded < 0 ? '-' : ''}$${Math.abs(rounded).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Compact axis labels: $950, $12k, $500k, $1.2M, $12M. */
export function formatMoneyCompact(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const num = m >= 10 ? String(Math.round(m)) : String(Math.round(m * 10) / 10)
    return `${sign}$${num}M`
  }
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}
