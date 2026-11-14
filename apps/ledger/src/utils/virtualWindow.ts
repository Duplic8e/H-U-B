export interface WindowInput {
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  totalRows: number
  overscan: number
}

export interface WindowResult {
  /** First row index to render. */
  startIndex: number
  /** One past the last row index to render. */
  endIndex: number
  /** Height in pixels of the spacer row above the window. */
  padTop: number
  /** Height in pixels of the spacer row below the window. */
  padBottom: number
}

/** Pure row windowing. A zero viewport height means the container has not been
 *  measured yet, in which case every row renders so the list is never blank
 *  before the first scroll event. */
export function computeWindow(input: WindowInput): WindowResult {
  const { scrollTop, viewportHeight, rowHeight, totalRows, overscan } = input

  if (viewportHeight <= 0 || rowHeight <= 0) {
    return { startIndex: 0, endIndex: totalRows, padTop: 0, padBottom: 0 }
  }

  const firstVisible = Math.floor(scrollTop / rowHeight)
  const visibleCount = Math.ceil(viewportHeight / rowHeight)

  const startIndex = Math.max(0, Math.min(firstVisible - overscan, Math.max(0, totalRows - 1)))
  const endIndex = Math.min(totalRows, firstVisible + visibleCount + overscan)

  return {
    startIndex,
    endIndex,
    padTop: startIndex * rowHeight,
    padBottom: Math.max(0, (totalRows - endIndex) * rowHeight),
  }
}
