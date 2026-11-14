import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Every persisted store must declare a persist `version`. Without one,
// zustand writes `version: 0` and a later schema change has no hook to
// migrate from: the store silently reads whatever shape is on disk. This
// is a source-level check because the stores are modules with side effects
// and importing all fourteen to inspect their options is not worth it.
const STORE_DIR = join(process.cwd(), 'src', 'store')

/** Anchored to the start of a line, and accepting an identifier as well as a
 *  literal. Both halves are load-bearing:
 *
 *  - `useBudgetStore` declares `version: BUDGET_PERSIST_VERSION`, a named
 *    constant, so a digits-only pattern reports a correctly versioned store
 *    as missing.
 *  - Unanchored, `version:` matches inside `useCadConversion:` in
 *    `useCompensationStore`, and inside the `version: number` parameter of
 *    every migrate function signature. The first of those hid a genuinely
 *    unversioned store from the audit that produced this task. */
const DECLARES_VERSION = /^\s*version:\s*(?:\d+|[A-Za-z_$][\w$]*)\s*,?$/m

/** Zustand discards a store's persisted state when it sees version 0 and the
 *  store declares a version with no migrate function. This pattern guards that
 *  any store declaring a version also declares a migrate to handle old data.
 *  Anchored to line start for the same reason DECLARES_VERSION is. */
const DECLARES_MIGRATE = /^\s*migrate:\s*/m

const storeSource = (file: string) => readFileSync(join(STORE_DIR, file), 'utf8')

/** useAccountsStore is persisted but deliberately declares no version, and
 *  says why in its own comment. Read that comment before adding anything
 *  here: an allowlist is for a decision someone made on purpose, not a
 *  place to park a store that is merely inconvenient. */
const NO_VERSION_BY_DESIGN = ['useAccountsStore.ts']

const persistedStores = readdirSync(STORE_DIR)
  .filter((f) => /^use.*Store\.ts$/.test(f))
  .filter((f) => storeSource(f).includes('persist('))

describe('persisted stores declare a version', () => {
  // Named exactly, not counted. A count assertion passes when one store is
  // deleted and another added, and `toBeGreaterThanOrEqual` passes even when
  // the glob matches nothing at all. useUndoStore is absent on purpose: it
  // holds in-session undo state and is not persisted.
  it('sees the stores this guard is meant to cover', () => {
    expect(persistedStores).toEqual([
      'useAccountsStore.ts', 'useAnalysisStore.ts', 'useBudgetStore.ts',
      'useCompensationStore.ts', 'useDashboardLayoutStore.ts', 'useMarketDataStore.ts',
      'usePlannerStore.ts', 'usePortfolioReportStore.ts', 'usePortfolioStore.ts',
      'useRecurringStore.ts', 'useSyncStore.ts', 'useThemeStore.ts',
      'useTradesStore.ts', 'useTriageStore.ts', 'useWheelStore.ts',
    ])
  })

  for (const file of persistedStores.filter((f) => !NO_VERSION_BY_DESIGN.includes(f))) {
    it(`${file} declares a persist version`, () => {
      expect(storeSource(file)).toMatch(DECLARES_VERSION)
    })

    it(`${file} pairs its version with a migrate`, () => {
      const source = storeSource(file)
      if (source.match(DECLARES_VERSION)) {
        expect(source).toMatch(DECLARES_MIGRATE)
      }
    })
  }
})
