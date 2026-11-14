import { useState } from 'react'

/** Rule 4 of docs/mobile-layout-rules.md: how many items a list inside a
 *  card shows on a phone before "Show all". */
export const PHONE_LIST_LIMIT = 5

/** Holdings per account on a phone, matching the allocation bar's top 8. */
export const PHONE_HOLDINGS_LIMIT = 8

export interface ShowMore<T> {
  visible: T[]
  /** True when the list is long enough to be capped at all. Render the
   *  ShowMoreButton only when this is true. */
  truncates: boolean
  expanded: boolean
  toggle: () => void
}

/** Caps a list at `limit` items until the user asks for the rest. A list
 *  only one item over the cap is shown whole: a "Show all 6" button that
 *  reveals a single row costs more space than the row does. Pass
 *  enabled=false for the desktop path, which shows everything. */
export function useShowMore<T>(items: readonly T[], limit: number, enabled = true): ShowMore<T> {
  const [expanded, setExpanded] = useState(false)
  const truncates = enabled && items.length > limit + 1
  return {
    visible: truncates && !expanded ? items.slice(0, limit) : [...items],
    truncates,
    expanded,
    toggle: () => setExpanded((v) => !v),
  }
}
