import { foldSmallest } from './foldSmallest'

describe('foldSmallest', () => {
  it('keeps the largest entries and folds the rest into one', () => {
    const out = foldSmallest([['a', 1], ['b', 50], ['c', 5], ['d', 30], ['e', 2]], 2, 'Other')
    expect(out).toEqual([['b', 50], ['d', 30], ['Other', 8]])
  })

  it('folds nothing when that would save at most one entry', () => {
    expect(foldSmallest([['a', 3], ['b', 2], ['c', 1]], 2, 'Other')).toEqual([['a', 3], ['b', 2], ['c', 1]])
  })

  it('merges into a kept entry that already has the fold label', () => {
    // 'Other' (40 + 30 + 25 = 95) outgrows 'b' (50), so the re-sort moves it first.
    const out = foldSmallest([['b', 50], ['Other', 40], ['c', 30], ['d', 25]], 2, 'Other')
    expect(out).toEqual([['Other', 95], ['b', 50]])
  })

  it('does not mutate its input', () => {
    const input: [string, number][] = [['a', 1], ['Other', 2], ['c', 3], ['d', 4]]
    foldSmallest(input, 2, 'Other')
    expect(input).toEqual([['a', 1], ['Other', 2], ['c', 3], ['d', 4]])
  })
})
