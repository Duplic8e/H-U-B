export interface SwapResult {
  invested: number
  originalReturn: number
  newReturn: number
  difference: number
}

/** What-if: the dollars invested in the out-ticker had bought the in-ticker
 *  at its start-date price instead. Returns are dollar P/L on `invested`. */
export function simulateSwap(
  invested: number,
  outStartPrice: number,
  outCurrentPrice: number,
  inStartPrice: number,
  inCurrentPrice: number,
): SwapResult {
  const originalReturn = outStartPrice > 0 ? invested * (outCurrentPrice / outStartPrice - 1) : 0
  const newReturn = inStartPrice > 0 ? invested * (inCurrentPrice / inStartPrice - 1) : 0
  return { invested, originalReturn, newReturn, difference: newReturn - originalReturn }
}
