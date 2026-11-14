import { groupSections, shouldShowWhatsNew, versionSeries } from './whatsNew'

describe('shouldShowWhatsNew', () => {
  it('does not show on first ever visit (no stored version)', () => {
    expect(shouldShowWhatsNew(null, '0.3.0-beta')).toBe(false)
  })
  it('shows when the stored version differs', () => {
    expect(shouldShowWhatsNew('0.2.0-beta', '0.3.0-beta')).toBe(true)
  })
  it('does not show when versions match', () => {
    expect(shouldShowWhatsNew('0.3.0-beta', '0.3.0-beta')).toBe(false)
  })
})

describe('versionSeries', () => {
  it('reduces a version to its major.minor series', () => {
    expect(versionSeries('0.7.5-beta')).toBe('0.7')
    expect(versionSeries('1.10.2')).toBe('1.10')
  })

  it('reads the version out of a changelog heading', () => {
    expect(versionSeries('[0.7.5-beta] - 2026-07-23')).toBe('0.7')
  })

  it('is null when there is no major.minor.patch to read', () => {
    expect(versionSeries('[Unreleased]')).toBeNull()
    expect(versionSeries('')).toBeNull()
  })
})

describe('groupSections version bucketing', () => {
  const s = (heading: string): { heading: string; body: string[] } => ({ heading, body: ['- something'] })

  it('keeps only the running version series out in the open', () => {
    const { current, older } = groupSections(
      [s('[0.7.5-beta] - 2026-07-23'), s('[0.7.0-beta] - 2026-07-17'), s('[0.6.1-beta] - 2026-07-16')],
      '0.7.5-beta',
    )
    expect(current.map((x) => x.heading)).toEqual(['[0.7.5-beta] - 2026-07-23', '[0.7.0-beta] - 2026-07-17'])
    expect(older.map((x) => x.heading)).toEqual(['[0.6.1-beta] - 2026-07-16'])
  })

  it('does not bury a heading with no parseable version', () => {
    const { current, older } = groupSections([s('[Unreleased]'), s('[0.6.0-beta] - 2026-07-16')], '0.7.5-beta')
    expect(current.map((x) => x.heading)).toEqual(['[Unreleased]'])
    expect(older.map((x) => x.heading)).toEqual(['[0.6.0-beta] - 2026-07-16'])
  })

  it('falls back to showing everything when nothing matches the running series', () => {
    const input = [s('[0.6.1-beta] - 2026-07-16'), s('[0.5.0-beta] - 2026-07-13')]
    const { current, older } = groupSections(input, '0.9.0-beta')
    expect(current).toEqual(input)
    expect(older).toEqual([])
  })
})
