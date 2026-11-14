const MENU_MAX = 256 // px, matches previous max-h-64
const MENU_MARGIN = 16
const MIN_BELOW = 160

/** Decide dropdown direction and scroll height from the trigger's rect. */
export function menuPlacement(
  rect: { top: number; bottom: number },
  viewportHeight: number,
): { openUp: boolean; maxHeight: number } {
  const below = viewportHeight - rect.bottom - MENU_MARGIN
  const above = rect.top - MENU_MARGIN
  if (below < MIN_BELOW && above > below) {
    return { openUp: true, maxHeight: Math.min(MENU_MAX, above) }
  }
  return { openUp: false, maxHeight: Math.min(MENU_MAX, Math.max(below, MIN_BELOW)) }
}
