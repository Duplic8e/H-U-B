/** The Equity Vesting Schedule brackets its 12 month window with two padding
 *  rows that carry no vests of their own.
 *
 *  The leading row holds the value the window OPENS on. Each month's figure is
 *  the amount left AFTER that month vests, so without it a vest in the very
 *  first month has nothing to fall from: its bar appears while the line shows
 *  no drop, and the auto-scaled axis pins the area flush to the top edge.
 *
 *  The trailing row repeats the final value, because a flat run after a vest
 *  only exists where later months carry the same amount, so the last drop would
 *  otherwise stop dead on its slope.
 *
 *  They are distinct strings because recharts keys categories by value and
 *  would fold two identical labels together. Neither is a real month, so the
 *  axis renders them blank and the tooltip skips them. */
export const LEADING_LABEL = 'pad-before'
export const TRAILING_LABEL = 'pad-after'

export function isPaddingLabel(label: unknown): boolean {
  return label === LEADING_LABEL || label === TRAILING_LABEL
}
