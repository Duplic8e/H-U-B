import { describe, it, expect, beforeEach } from 'vitest'
import { buildBackup, restoreBackup, BACKUP_VERSION, type BackupEnvelope, backupToBlob, backupFilename, parseBackupText, BACKUP_KEYS } from './backup'
import { STORAGE_KEYS } from '../store/storageKeys'
import { useAccountsStore } from '../store/useAccountsStore'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { useBudgetStore } from '../store/useBudgetStore'
import { monthlyExpenseTotal, monthlyIncomeTotal } from '../store/budgetSelectors'

describe('Refunds & Payments backup compatibility', () => {
  beforeEach(() => localStorage.clear())

  it.each([false, true])('retains preference %s and signed allocations through restore and rehydration', async enabled => {
    const transactions = {
      purchase: { id: 'purchase', date: '2026-10-01', type: 'expense' as const, amount: 60, description: 'Purchase', categoryId: 'food' },
      receipt: { id: 'receipt', date: '2026-10-13', type: 'expense' as const, amount: -100, description: 'Receipt', categoryId: 'food', splits: [{ categoryId: 'other', amount: -30 }] },
    }
    const payload = { version: 5, state: { transactions, refundsAndPaymentsEnabled: enabled,
      categoryGroups: { expenses: { id: 'expenses', name: 'Expenses', kind: 'expense' } },
      categories: { food: { id: 'food', groupId: 'expenses', name: 'Groceries', targetAmount: 100 }, other: { id: 'other', groupId: 'expenses', name: 'Other', targetAmount: 100 } },
    } }
    localStorage.setItem(STORAGE_KEYS.budget, JSON.stringify(payload))
    const backup = buildBackup()
    expect(backup.version).toBe(2)
    expect(backup.data[STORAGE_KEYS.budget]).toEqual(payload)
    localStorage.clear()
    restoreBackup(backup)
    await useBudgetStore.persist.rehydrate()
    const state = useBudgetStore.getState()
    expect(state.refundsAndPaymentsEnabled).toBe(enabled)
    expect(state.transactions).toEqual(transactions)
    expect(monthlyExpenseTotal(state.transactions, '2026-10')).toBe(-40)
    expect(monthlyIncomeTotal(state.transactions, '2026-10')).toBe(0)
  })

  it('defaults an older v4 backup to enabled without changing transactions', async () => {
    useBudgetStore.setState({ refundsAndPaymentsEnabled: false })
    const transactions = { old: { id: 'old', date: '2026-09-01', type: 'expense', amount: -40, description: 'Old receipt' } }
    restoreBackup({ app: 'ledger', version: 2, exportedAt: '', data: {
      [STORAGE_KEYS.budget]: { version: 4, state: { transactions, categories: {}, categoryGroups: {} } },
    } })
    await useBudgetStore.persist.rehydrate()
    expect(useBudgetStore.getState().refundsAndPaymentsEnabled).toBe(true)
    expect(useBudgetStore.getState().transactions).toEqual(transactions)
  })
})

describe('backup', () => {
  beforeEach(() => localStorage.clear())

  it('builds an envelope from present keys and skips absent ones', () => {
    localStorage.setItem('ledger-compensation', JSON.stringify({ a: 1 }))
    const env = buildBackup()
    expect(env.app).toBe('ledger')
    expect(env.version).toBe(BACKUP_VERSION)
    expect(env.data['ledger-compensation']).toEqual({ a: 1 })
    expect('ledger-budget' in env.data).toBe(false)
  })

  it('registers the market-data store key', () => {
    expect(BACKUP_KEYS).toContain('ledger-market-data')
  })

  it('registers the planner store key', () => {
    expect(BACKUP_KEYS).toContain('ledger-planner')
  })

  it('registers the analyses store key', () => {
    expect(BACKUP_KEYS).toContain('ledger-analyses')
  })

  it('registers the portfolio store key', () => {
    expect(BACKUP_KEYS).toContain('ledger-portfolio')
  })

  it('registers the dashboard layout key', () => {
    expect(BACKUP_KEYS).toContain('ledger-dashboard-layout')
  })

  it('registers the wheel store key', () => {
    expect(BACKUP_KEYS).toContain('ledger-wheel')
  })

  it('round-trips: restore writes values back as JSON strings', () => {
    const env: BackupEnvelope = {
      version: BACKUP_VERSION, exportedAt: '2026-07-02T00:00:00Z', app: 'ledger',
      data: { 'ledger-budget': { x: 2 } },
    }
    restoreBackup(env)
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ x: 2 })
  })

  it('round-trips exclusion history inside the existing triage key', () => {
    const payload = { version: 3, state: {
      exclusionRules: { rule: { id: 'rule', revision: 2, enabled: false } },
      importRecords: { ignored: { decision: 'ignored', ignoreReason: 'rule', exclusionMatches: [{ ruleId: 'rule', revision: 1, name: 'Original' }] },
        included: { decision: 'pending', exclusionOverride: 'include' } },
    } }
    localStorage.setItem(STORAGE_KEYS.triage, JSON.stringify(payload))
    const backup = buildBackup()
    expect(backup.data[STORAGE_KEYS.triage]).toEqual(payload)
    localStorage.clear()
    restoreBackup(backup)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.triage)!)).toEqual(payload)
    expect(BACKUP_KEYS.filter(key => key.includes('exclusion'))).toEqual([])
  })

  it('rejects a non-Ledger or future-version envelope', () => {
    expect(() => restoreBackup({ app: 'other' } as unknown as BackupEnvelope))
      .toThrow('Invalid Ledger backup file')
    expect(() => restoreBackup({ app: 'ledger', version: BACKUP_VERSION + 1, exportedAt: '', data: {} }))
      .toThrow('Invalid Ledger backup file')
  })
})

describe('backup file io', () => {
  beforeEach(() => localStorage.clear())

  it('backupToBlob produces JSON blob', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ x: 2 }))
    const blob = backupToBlob()
    expect(blob.type).toBe('application/json')
    const parsed = JSON.parse(await blob.text())
    expect(parsed.data['ledger-budget']).toEqual({ x: 2 })
  })

  it('backupFilename is date-stamped', () => {
    expect(backupFilename()).toMatch(/^ledger-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('parseBackupText validates and returns the envelope', () => {
    const good = JSON.stringify({ app: 'ledger', version: 1, exportedAt: '', data: {} })
    expect(parseBackupText(good).app).toBe('ledger')
    expect(() => parseBackupText('{not json')).toThrow('Invalid Ledger backup file')
    expect(() => parseBackupText(JSON.stringify({ app: 'nope' }))).toThrow('Invalid Ledger backup file')
  })
})

describe('backup v2 envelope', () => {
  beforeEach(() => localStorage.clear())

  it('is version 2', () => {
    expect(BACKUP_VERSION).toBe(2)
  })

  it('omits sync metadata when no meta is supplied', () => {
    const env = buildBackup()
    expect(env.deviceId).toBeUndefined()
    expect(env.revision).toBeUndefined()
  })

  it('carries sync metadata when meta is supplied', () => {
    const env = buildBackup({ deviceId: 'dev-1', deviceName: 'Desktop', revision: 7, baseRevision: 6 })
    expect(env.deviceId).toBe('dev-1')
    expect(env.deviceName).toBe('Desktop')
    expect(env.revision).toBe(7)
    expect(env.baseRevision).toBe(6)
  })

  it('still accepts a version 1 envelope', () => {
    const v1 = JSON.stringify({ app: 'ledger', version: 1, exportedAt: '', data: { 'ledger-budget': { x: 1 } } })
    const env = parseBackupText(v1)
    expect(env.version).toBe(1)
    restoreBackup(env)
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ x: 1 })
  })

  it('writes nothing when the envelope is invalid', () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ keep: true }))
    expect(() => restoreBackup({ app: 'ledger', version: 99, exportedAt: '', data: { 'ledger-budget': { x: 9 } } }))
      .toThrow('Invalid Ledger backup file')
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ keep: true })
  })

  it('rejects a string data field and writes nothing', () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ keep: true }))
    expect(() => restoreBackup({ app: 'ledger', version: BACKUP_VERSION, exportedAt: '', data: 'not an object' as unknown as Record<string, unknown> }))
      .toThrow('Invalid Ledger backup file')
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ keep: true })
  })

  it('rejects an array data field and writes nothing', () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ keep: true }))
    expect(() => restoreBackup({ app: 'ledger', version: BACKUP_VERSION, exportedAt: '', data: [1, 2, 3] as unknown as Record<string, unknown> }))
      .toThrow('Invalid Ledger backup file')
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ keep: true })
  })

  it('rejects a null data field and writes nothing', () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ keep: true }))
    expect(() => restoreBackup({ app: 'ledger', version: BACKUP_VERSION, exportedAt: '', data: null as unknown as Record<string, unknown> }))
      .toThrow('Invalid Ledger backup file')
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ keep: true })
  })

  it('writes only registered keys, leaving unregistered ones untouched', () => {
    // Snapshot files sit in a hand-editable Drive folder and the same code
    // path backs manual Import. A crafted data blob naming ledger-sync
    // must not be able to overwrite this device's sync bookmark.
    localStorage.setItem('ledger-sync', JSON.stringify({ deviceId: 'this-device', lastSyncedRevision: 3 }))
    localStorage.setItem('some-random-key', JSON.stringify({ mine: true }))
    restoreBackup({
      app: 'ledger', version: BACKUP_VERSION, exportedAt: '',
      data: {
        'ledger-budget': { x: 1 },
        'ledger-sync': { deviceId: 'attacker', lastSyncedRevision: 999 },
        'some-random-key': { evil: true },
      },
    })
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ x: 1 })
    expect(JSON.parse(localStorage.getItem('ledger-sync')!)).toEqual({ deviceId: 'this-device', lastSyncedRevision: 3 })
    expect(JSON.parse(localStorage.getItem('some-random-key')!)).toEqual({ mine: true })
  })
})

describe('backup key coverage', () => {
  it('backs up the PortfolioAnalyst report store', () => {
    expect(BACKUP_KEYS).toContain('ledger-portfolio-report')
  })

  it('leaves per-device sync bookkeeping out of the backup', () => {
    expect(BACKUP_KEYS).not.toContain('ledger-sync')
  })

  it('leaves the demo flag and demo budget data out of the backup', () => {
    expect(BACKUP_KEYS).not.toContain('ledger-demo-mode')
    localStorage.setItem('ledger-demo-mode', 'on')
    localStorage.setItem(
      'ledger-budget',
      JSON.stringify({
        state: {
          transactions: {
            'demo-tx-1': { id: 'demo-tx-1', description: 'Grocery run' },
            'real-tx-1': { id: 'real-tx-1', description: 'Rent' },
          },
          categories: { 'demo-cat-1': { id: 'demo-cat-1', name: 'Groceries' } },
        },
      }),
    )
    const env = buildBackup()
    expect(env.data['ledger-demo-mode']).toBeUndefined()
    const budgetState = (env.data['ledger-budget'] as { state: { transactions: Record<string, unknown>; categories: Record<string, unknown> } }).state
    expect(budgetState.transactions['demo-tx-1']).toBeUndefined()
    expect(budgetState.transactions['real-tx-1']).toEqual({ id: 'real-tx-1', description: 'Rent' })
    expect(budgetState.categories['demo-cat-1']).toBeUndefined()
  })

  it('covers every registered store except the declared exclusions', () => {
    // This list is written out by hand on purpose, not derived from
    // NON_BACKUP_KEY_NAMES. If it were computed from that same list, this
    // test would only check that backup.ts re-implements a formula copied
    // from itself, and a mistaken addition to NON_BACKUP_KEY_NAMES would
    // pass silently on both sides. Adding a new non-backup key must force a
    // human to update this list too.
    const expected = [
      STORAGE_KEYS.accounts,
      STORAGE_KEYS.budget,
      STORAGE_KEYS.compensation,
      STORAGE_KEYS.theme,
      STORAGE_KEYS.triage,
      STORAGE_KEYS.marketData,
      STORAGE_KEYS.planner,
      STORAGE_KEYS.analyses,
      STORAGE_KEYS.portfolio,
      STORAGE_KEYS.portfolioReport,
      STORAGE_KEYS.dashboardLayout,
      STORAGE_KEYS.wheel,
      STORAGE_KEYS.recurring,
      STORAGE_KEYS.trades,
    ]
    expect([...BACKUP_KEYS].sort()).toEqual([...expected].sort())
  })

  it('round-trips the PortfolioAnalyst report through a backup', () => {
    localStorage.setItem('ledger-portfolio-report', JSON.stringify({ state: { report: { id: 'r1' } } }))
    const env = buildBackup()
    localStorage.clear()
    restoreBackup(env)
    expect(JSON.parse(localStorage.getItem('ledger-portfolio-report') as string)).toEqual({
      state: { report: { id: 'r1' } },
    })
  })
})

describe('appVersion stamping', () => {
  beforeEach(() => localStorage.clear())

  it('stamps the running app version into the envelope', () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ state: { transactions: {} } }))
    const env = buildBackup()
    expect(env.appVersion).toBe(__APP_VERSION__)
    expect(typeof env.appVersion).toBe('string')
  })

  it('accepts an envelope with no appVersion, which is every pre-0.9.8 snapshot', () => {
    const legacy = {
      version: 2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      app: 'ledger' as const,
      data: { 'ledger-budget': { state: { transactions: {} } } },
    }
    expect(() => parseBackupText(JSON.stringify(legacy))).not.toThrow()
    expect(parseBackupText(JSON.stringify(legacy)).appVersion).toBeUndefined()
  })
})

describe('account currency backup restoration', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips review state, currency, history, pending edit, and market override through real rehydration', async () => {
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify({ state: {
      accounts: [{ id: 'usd', name: 'USD savings', value: 100, type: 'bank', currency: 'USD' }],
      history: [{ date: '2026-09-01', value: 120 }],
      pendingCurrencyReviewIds: ['usd'], currencySupportStartedAt: '2026-10-01',
      pendingEditSnapshotDate: '2026-10-06',
    } }))
    localStorage.setItem(STORAGE_KEYS.marketData, JSON.stringify({ state: {
      quotes: {}, historical: {}, fx: {}, overrides: { 'USD/CAD': 1.35 },
    }, version: 1 }))
    const backup = buildBackup()
    expect(backup.version).toBe(BACKUP_VERSION)
    localStorage.clear()
    restoreBackup(backup)
    await useAccountsStore.persist.rehydrate()
    await useMarketDataStore.persist.rehydrate()
    expect(useAccountsStore.getState()).toMatchObject({
      accounts: [{ id: 'usd', currency: 'USD', value: 100 }],
      history: [{ date: '2026-09-01', value: 120 }],
      pendingCurrencyReviewIds: ['usd'], currencySupportStartedAt: '2026-10-01',
      pendingEditSnapshotDate: '2026-10-06',
    })
    expect(useMarketDataStore.getState().overrides).toEqual({ 'USD/CAD': 1.35 })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.accounts)!).version).toBeUndefined()
  })

  it('reopens review when a legacy raw-envelope backup is restored', async () => {
    const legacy = {
      app: 'ledger' as const, version: BACKUP_VERSION, exportedAt: '2026-09-01T00:00:00Z',
      data: { [STORAGE_KEYS.accounts]: { state: {
        accounts: [{ id: 'old', name: 'Old savings', type: 'bank', value: 500 }],
        history: [{ date: '2026-09-01', value: 500 }],
      } } },
    }
    restoreBackup(legacy)
    await useAccountsStore.persist.rehydrate()
    expect(useAccountsStore.getState()).toMatchObject({
      accounts: [{ id: 'old', currency: 'CAD', value: 500 }],
      pendingCurrencyReviewIds: ['old'],
      history: [{ date: '2026-09-01', value: 500 }],
    })
    expect(useAccountsStore.getState().currencySupportStartedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.accounts)!)
    expect(persisted.version).toBeUndefined()
    expect(persisted.state.currencySupportStartedAt).toBe(useAccountsStore.getState().currencySupportStartedAt)
    expect(persisted.state.pendingCurrencyReviewIds).toEqual(['old'])
  })

  it('leaves an unsupported saved currency untouched when rehydration rejects it', async () => {
    const raw = JSON.stringify({ state: {
      accounts: [{ id: 'euro', name: 'Euro', type: 'bank', value: 50, currency: 'EUR' }],
      history: [{ date: '2026-09-01', value: 50 }],
    } })
    localStorage.setItem(STORAGE_KEYS.accounts, raw)
    await expect(useAccountsStore.persist.rehydrate()).rejects.toThrow(/unsupported account currency: EUR/i)
    expect(localStorage.getItem(STORAGE_KEYS.accounts)).toBe(raw)

    const beforeEdit = useAccountsStore.getState()
    expect(() => useAccountsStore.getState().addAccount({ name: 'New', type: 'bank', value: 100 })).toThrow(/account data could not be loaded/i)
    expect(() => useAccountsStore.setState({ history: [] })).toThrow(/account data could not be loaded/i)
    expect(useAccountsStore.getState()).toEqual(beforeEdit)
    expect(localStorage.getItem(STORAGE_KEYS.accounts)).toBe(raw)

    const corrected = JSON.stringify({ state: {
      accounts: [{ id: 'euro', name: 'Euro', type: 'bank', value: 50, currency: 'USD' }],
      history: [{ date: '2026-09-01', value: 50 }],
    } })
    localStorage.setItem(STORAGE_KEYS.accounts, corrected)
    await useAccountsStore.persist.rehydrate()
    expect(useAccountsStore.getState().accounts).toEqual([{ id: 'euro', name: 'Euro', type: 'bank', value: 50, currency: 'USD' }])
    expect(useAccountsStore.getState().history).toEqual([{ date: '2026-09-01', value: 50 }])
    useAccountsStore.getState().updateAccount('euro', { value: 60 })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.accounts)!).state.accounts[0].value).toBe(60)
  })
})
