export const LAST_SEEN_VERSION_KEY = 'ledger-last-seen-version'

/** Show once per version change; never on a brand-new install. */
export function shouldShowWhatsNew(stored: string | null, current: string): boolean {
  return stored !== null && stored !== current
}

/** The major.minor series a version belongs to: "0.7.5-beta" -> "0.7". Also
 *  reads a changelog heading like "[0.7.5-beta] - 2026-07-23". Null for
 *  anything without a leading major.minor.patch, such as "[Unreleased]". */
export function versionSeries(version: string): string | null {
  const m = /(\d+)\.(\d+)\.\d+/.exec(version)
  return m ? `${m[1]}.${m[2]}` : null
}

/** One changelog version block: its "## " heading and the lines beneath it. */
export interface VersionSection {
  heading: string
  body: string[]
}

/** Splits sections into the running version's own release series and everything
 *  older. A section with no parseable version (an "[Unreleased]" heading) stays
 *  with the current series rather than being buried. Falls back to listing
 *  everything as current if nothing matches, so a version string the parser
 *  cannot read never empties the modal. */
export function groupSections(
  sections: VersionSection[],
  appVersion: string,
): { current: VersionSection[]; older: VersionSection[] } {
  const series = versionSeries(appVersion)
  if (!series) return { current: sections, older: [] }
  const older = sections.filter((s) => {
    const v = versionSeries(s.heading)
    return v !== null && v !== series
  })
  const current = sections.filter((s) => !older.includes(s))
  return current.length > 0 ? { current, older } : { current: sections, older: [] }
}
