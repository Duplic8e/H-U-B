/** Keeps the `keep` largest entries and folds the rest into one entry named
 *  `otherLabel`, so a narrow chart draws a few readable bands instead of a
 *  label per category (rule 6 of docs/mobile-layout-rules.md). Returns a new
 *  array, largest first, with the fold last. Nothing is folded when that would
 *  save at most one entry. If a kept entry already carries `otherLabel`, the
 *  fold merges into it rather than drawing two bands with the same name; the
 *  result is then re-sorted, so that merged entry sits wherever its new total
 *  ranks instead of last. */
export function foldSmallest(entries: [string, number][], keep: number, otherLabel: string): [string, number][] {
  const sorted = entries.map(([name, value]) => [name, value] as [string, number]).sort((a, b) => b[1] - a[1])
  if (sorted.length <= keep + 1) return sorted
  const kept = sorted.slice(0, keep)
  const rest = sorted.slice(keep).reduce((sum, [, value]) => sum + value, 0)
  const existing = kept.find(([name]) => name === otherLabel)
  if (existing) {
    existing[1] += rest
    return kept.sort((a, b) => b[1] - a[1])
  }
  // The fold stays last however large it grows, so "Other" reads as the tail
  // of the list rather than jumping to the top of the chart.
  kept.push([otherLabel, rest])
  return kept
}
