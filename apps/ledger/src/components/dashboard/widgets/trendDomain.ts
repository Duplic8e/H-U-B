/** Brokerage-style axis: track the data range with headroom, never force zero. */
export function trendDomain(values: number[]): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const pad = range > 0 ? range * 0.08 : Math.max(Math.abs(max) * 0.05, 1)
  return [min - pad, max + pad]
}
