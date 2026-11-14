import type { Category } from '../../types/budget'

/** Chase's own category column, mapped onto the names of the default ledger
 *  categories. Health & Wellness is deliberately absent: no default category
 *  fits it, and a wrong guess is worse than leaving the row uncategorized. */
const CHASE_TO_LEDGER: Record<string, string> = {
  Groceries: 'Groceries',
  'Food & Drink': 'Takeout',
  Travel: 'Transportation',
  Shopping: 'Personal',
  Entertainment: 'Night Out',
  'Gifts & Donations': 'Gifts',
}

/** The id of the ledger category Chase's category suggests, or undefined.
 *
 *  Resolution is by name against the categories that exist right now, so a
 *  category the user renamed or deleted simply misses instead of resolving to
 *  something they did not intend. */
export function chaseCategoryId(
  chaseCategory: string | undefined,
  categories: Record<string, Category>,
): string | undefined {
  if (!chaseCategory) return undefined
  const targetName = CHASE_TO_LEDGER[chaseCategory]
  if (!targetName) return undefined
  const wanted = targetName.toLowerCase()
  return Object.values(categories).find((c) => c.name.toLowerCase() === wanted)?.id
}
