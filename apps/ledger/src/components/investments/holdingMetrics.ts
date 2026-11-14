export const pct = (v: number | null) => (v === null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)

/** A share of the portfolio. Unsigned, because a weight is not a change:
 *  `pct` prefixes a plus, which made the allocation column read "+15.0%" as
 *  though the position had gained fifteen percent. */
export const share = (v: number | null) => (v === null ? '-' : `${v.toFixed(1)}%`)
