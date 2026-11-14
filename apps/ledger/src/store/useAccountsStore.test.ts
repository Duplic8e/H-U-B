import { useAccountsStore, stripDemoAccounts, normalizeAccountState, DEMO_ACCOUNTS, type NormalizedAccountState } from './useAccountsStore'

const initialState = useAccountsStore.getState()

beforeEach(() => {
  useAccountsStore.setState(initialState, true)
})

describe('useAccountsStore defaults', () => {
  it('starts with no accounts so a new install shows the user their own money only', () => {
    expect(useAccountsStore.getState().accounts).toEqual([])
    expect(useAccountsStore.getState().getNetWorth()).toBe(0)
  })

  it('starts with currency review metadata', () => {
    expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual([])
    expect(useAccountsStore.getState().currencySupportStartedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('legacy account currency normalization', () => {
  it('normalizes absent currency without rewriting history, snapshots, or unknown fields', () => {
    const history = [{ date: '2026-09-01', value: 500 }]
    const legacy = { accounts: [{ id: 'a', name: 'Savings', type: 'bank', value: 500 }], history, pendingEditSnapshotDate: '2026-10-06', extra: { keep: true } }
    const next = normalizeAccountState(legacy, '2026-10-06') as NormalizedAccountState & { extra: unknown }
    expect(next.accounts[0]).toMatchObject({ currency: 'CAD', value: 500 })
    expect(next.pendingCurrencyReviewIds).toEqual(['a'])
    expect(next.currencySupportStartedAt).toBe('2026-10-06')
    expect(next.history).toEqual(history)
    expect(next.pendingEditSnapshotDate).toBe('2026-10-06')
    expect(next.extra).toEqual({ keep: true })
    expect(normalizeAccountState(next, '2026-10-07')).toEqual(next)
  })

  it('keeps valid currencies and an existing support marker on repeat loads', () => {
    const saved = {
      accounts: [
        { id: 'cad', name: 'CAD', type: 'bank', value: 10, currency: 'CAD' },
        { id: 'usd', name: 'USD', type: 'bank', value: 20, currency: 'USD' },
      ],
      history: [], pendingCurrencyReviewIds: [], currencySupportStartedAt: '2026-09-01',
    }
    expect(normalizeAccountState(saved, '2026-10-06')).toMatchObject(saved)
  })

  it('rejects unsupported saved currency without mutating the persisted payload', () => {
    const saved = { accounts: [{ id: 'a', name: 'Euro', type: 'bank', value: 50, currency: 'EUR' }], history: [{ date: '2026-01-01', value: 50 }] }
    const original = structuredClone(saved)
    expect(() => normalizeAccountState(saved, '2026-10-06')).toThrow(/unsupported account currency/i)
    expect(saved).toEqual(original)
  })
})

describe('currency review confirmation', () => {
  it('confirms all CAD in one update and does not requeue after hydration', async () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a', name: 'Cash', value: 100, type: 'bank', currency: 'CAD' }],
      pendingCurrencyReviewIds: ['a'], history: [],
    })
    useAccountsStore.getState().confirmCurrencyReview({ a: 'CAD' })
    expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual([])
    expect(useAccountsStore.getState().history).toHaveLength(1)
    await useAccountsStore.persist.rehydrate()
    expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual([])
  })

  it('uses current balances, keeps accounts added during review, and requests one snapshot for a USD correction', () => {
    useAccountsStore.setState({
      accounts: [
        { id: 'a', name: 'Cash', value: 200, type: 'bank', currency: 'CAD' },
        { id: 'new', name: 'New', value: 30, type: 'bank', currency: 'CAD' },
      ],
      pendingCurrencyReviewIds: ['a'], history: [],
    })
    useAccountsStore.getState().confirmCurrencyReview({ a: 'USD' })
    expect(useAccountsStore.getState().accounts).toEqual([
      { id: 'a', name: 'Cash', value: 200, type: 'bank', currency: 'USD' },
      { id: 'new', name: 'New', value: 30, type: 'bank', currency: 'CAD' },
    ])
    expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual([])
    expect(useAccountsStore.getState().pendingEditSnapshotDate).toBe(new Date().toISOString().slice(0, 10))
    expect(useAccountsStore.getState().history).toEqual([])
  })

  it('ignores deleted draft rows and removes pending IDs when an account is deleted', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a', name: 'Cash', value: 100, type: 'bank', currency: 'CAD' }],
      pendingCurrencyReviewIds: ['a', 'deleted'], history: [],
    })
    useAccountsStore.getState().removeAccount('a')
    expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual(['deleted'])
    useAccountsStore.getState().confirmCurrencyReview({ deleted: 'USD' })
    expect(useAccountsStore.getState().accounts).toEqual([])
    expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual([])
  })

  it('rejects an invalid batch atomically', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a', name: 'Cash', value: 100, type: 'bank', currency: 'CAD' }],
      pendingCurrencyReviewIds: ['a'], history: [],
    })
    const before = useAccountsStore.getState()
    expect(() => useAccountsStore.getState().confirmCurrencyReview({ a: 'USD', other: 'EUR' as 'CAD' })).toThrow(/unsupported account currency/i)
    expect(useAccountsStore.getState()).toEqual(before)
  })
})

describe('useAccountsStore net worth', () => {
  it('does not treat an unavailable USD balance as CAD', () => {
    useAccountsStore.setState({ accounts: [
      { id: 'cad', name: 'CAD', value: 100, type: 'bank', currency: 'CAD' },
      { id: 'usd', name: 'USD', value: 100, type: 'bank', currency: 'USD' },
    ] })
    expect(useAccountsStore.getState().getTotalByType('bank')).toBeNull()
    expect(useAccountsStore.getState().getNetWorth()).toBeNull()
    expect(useAccountsStore.getState().getNetWorthTrend()).toBeNull()
    expect(useAccountsStore.getState().getNetWorth(1.35)).toBe(235)
  })

  it('defaults newly added accounts to CAD', () => {
    useAccountsStore.getState().addAccount({ name: 'Cash', value: 10, type: 'bank' })
    expect(useAccountsStore.getState().accounts[0].currency).toBe('CAD')
  })

  it('defers a USD account edit and later snapshots the latest account list', () => {
    const today = new Date().toISOString().split('T')[0]
    useAccountsStore.getState().addAccount({ name: 'USD', value: 100, type: 'bank', currency: 'USD' })
    expect(useAccountsStore.getState().history).toEqual([])
    expect(useAccountsStore.getState().pendingEditSnapshotDate).toBe(today)
    const id = useAccountsStore.getState().accounts[0].id
    useAccountsStore.getState().updateAccount(id, { value: 200 })
    useAccountsStore.getState().ensureDailySnapshot(1.5)
    expect(useAccountsStore.getState().history).toEqual([{ date: today, value: 300 }])
    expect(useAccountsStore.getState().pendingEditSnapshotDate).toBeNull()
  })

  it('lets a pending edit replace today but not a rate-only ensure call', () => {
    const today = new Date().toISOString().split('T')[0]
    useAccountsStore.setState({
      accounts: [{ id: 'usd', name: 'USD', value: 100, type: 'bank', currency: 'USD' }],
      history: [{ date: today, value: 999 }, { date: '2026-01-01', value: 12 }],
    })
    useAccountsStore.getState().ensureDailySnapshot(1.5)
    expect(useAccountsStore.getState().history[0].value).toBe(999)
    useAccountsStore.getState().updateAccount('usd', { value: 200 })
    useAccountsStore.getState().ensureDailySnapshot(1.5)
    expect(useAccountsStore.getState().history).toEqual([
      { date: '2026-01-01', value: 12 }, { date: today, value: 300 },
    ])
  })

  it('drops an expired pending edit without backfilling', () => {
    const today = new Date().toISOString().split('T')[0]
    useAccountsStore.setState({
      accounts: [{ id: 'usd', name: 'USD', value: 100, type: 'bank', currency: 'USD' }],
      history: [],
      pendingEditSnapshotDate: '2025-01-01',
    })
    useAccountsStore.getState().ensureDailySnapshot(1.5)
    expect(useAccountsStore.getState().pendingEditSnapshotDate).toBeNull()
    expect(useAccountsStore.getState().history).toEqual([{ date: today, value: 150 }])
  })

  it('subtracts debts from assets', () => {
    useAccountsStore.setState({
      accounts: [
        { id: 'a', name: 'Chequing', value: 1000, type: 'bank', currency: 'CAD' },
        { id: 'b', name: 'Brokerage', value: 4000, type: 'investment', currency: 'CAD' },
        { id: 'c', name: 'Owed by Sam', value: 500, type: 'receivable', currency: 'CAD' },
        { id: 'd', name: 'Card', value: 1500, type: 'debt', currency: 'CAD' },
      ],
    })
    expect(useAccountsStore.getState().getNetWorth()).toBe(4000)
  })

  it('records one snapshot per day and overwrites the same day rather than appending', () => {
    useAccountsStore.getState().addAccount({ name: 'Chequing', value: 100, type: 'bank' })
    useAccountsStore.getState().addAccount({ name: 'Savings', value: 200, type: 'bank' })
    const history = useAccountsStore.getState().history
    expect(history).toHaveLength(1)
    expect(history[0].value).toBe(300)
  })

  it('reports a zero trend when there is no earlier snapshot to compare against', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a', name: 'Chequing', value: 1000, type: 'bank', currency: 'CAD' }],
      history: [],
    })
    expect(useAccountsStore.getState().getNetWorthTrend()).toBe(0)
  })
})

describe('stripDemoAccounts', () => {
  it('drops the four untouched demo accounts', () => {
    const stripped = stripDemoAccounts({ accounts: [...DEMO_ACCOUNTS], history: [] }) as {
      accounts: unknown[]
    }
    expect(stripped.accounts).toEqual([])
  })

  it('keeps a demo row the user edited', () => {
    const edited = { ...DEMO_ACCOUNTS[0], value: 22000 }
    const stripped = stripDemoAccounts({ accounts: [edited], history: [] }) as {
      accounts: { value: number }[]
    }
    expect(stripped.accounts).toEqual([edited])
  })

  it("keeps the user's own accounts alongside removing the demo rows", () => {
    const mine = { id: 'mine', name: 'Tangerine', value: 42, type: 'bank' as const }
    const stripped = stripDemoAccounts({ accounts: [...DEMO_ACCOUNTS, mine], history: [] }) as {
      accounts: unknown[]
    }
    expect(stripped.accounts).toEqual([mine])
  })

  it('survives state with no accounts array', () => {
    expect(stripDemoAccounts({ history: [] })).toEqual({ history: [] })
  })

  it('survives state where accounts is not an array', () => {
    const state = { accounts: 'not an array', history: [{ date: '2026-01-01', value: 5 }] }
    expect(stripDemoAccounts(state)).toEqual(state)
  })

  it('clears history when demo rows are actually removed', () => {
    const stripped = stripDemoAccounts({
      accounts: [...DEMO_ACCOUNTS],
      history: [{ date: '2026-01-01', value: -220000 }],
    }) as { history: unknown[] }
    expect(stripped.history).toEqual([])
  })

  it('keeps history untouched when no accounts match a demo row', () => {
    const mine = { id: 'mine', name: 'Tangerine', value: 42, type: 'bank' as const }
    const history = [{ date: '2026-01-01', value: 42 }]
    const stripped = stripDemoAccounts({ accounts: [mine], history }) as { history: unknown[] }
    expect(stripped.history).toEqual(history)
  })

  it('is idempotent: a second call on already-stripped state removes nothing more and does not clear history again', () => {
    const mine = { id: 'mine', name: 'Tangerine', value: 42, type: 'bank' as const }
    const history = [{ date: '2026-01-01', value: 42 }]
    const once = stripDemoAccounts({ accounts: [...DEMO_ACCOUNTS, mine], history }) as {
      accounts: unknown[]
      history: unknown[]
    }
    // First call removes the demos and clears history, since demos were present.
    expect(once.accounts).toEqual([mine])
    expect(once.history).toEqual([])

    // A second call on the already-stripped result should be a no-op: nothing
    // left matches a demo row, and history (now empty, but genuinely so) is
    // not cleared again just because it ran a second time.
    const startingHistory = [{ date: '2026-02-01', value: 42 }]
    const twice = stripDemoAccounts({ accounts: once.accounts, history: startingHistory }) as {
      accounts: unknown[]
      history: unknown[]
    }
    expect(twice.accounts).toEqual([mine])
    expect(twice.history).toEqual(startingHistory)
  })
})

describe('editable net worth history', () => {
  it('adds a dated snapshot and keeps history sorted oldest first', () => {
    useAccountsStore.setState({ accounts: [], history: [{ date: '2026-08-01', value: 100 }] })
    useAccountsStore.getState().setSnapshot('2026-06-01', 50)
    expect(useAccountsStore.getState().history).toEqual([
      { date: '2026-06-01', value: 50 },
      { date: '2026-08-01', value: 100 },
    ])
  })

  it('overwrites the snapshot for a date rather than appending a second one', () => {
    useAccountsStore.setState({ accounts: [], history: [{ date: '2026-08-01', value: 100 }] })
    useAccountsStore.getState().setSnapshot('2026-08-01', 175)
    expect(useAccountsStore.getState().history).toEqual([{ date: '2026-08-01', value: 175 }])
  })

  it('removes a snapshot by date', () => {
    useAccountsStore.setState({
      accounts: [],
      history: [{ date: '2026-08-01', value: 100 }, { date: '2026-08-02', value: 110 }],
    })
    useAccountsStore.getState().removeSnapshot('2026-08-01')
    expect(useAccountsStore.getState().history).toEqual([{ date: '2026-08-02', value: 110 }])
  })

  it('records today on ensureDailySnapshot when there is none yet', () => {
    const today = new Date().toISOString().split('T')[0]
    useAccountsStore.setState({
      accounts: [{ id: 'a', name: 'Chequing', value: 900, type: 'bank', currency: 'CAD' }],
      history: [],
    })
    useAccountsStore.getState().ensureDailySnapshot()
    expect(useAccountsStore.getState().history).toEqual([{ date: today, value: 900 }])
  })

  it('leaves an existing snapshot for today alone, so opening the app does not overwrite an edit', () => {
    const today = new Date().toISOString().split('T')[0]
    useAccountsStore.setState({
      accounts: [{ id: 'a', name: 'Chequing', value: 900, type: 'bank', currency: 'CAD' }],
      history: [{ date: today, value: 12345 }],
    })
    useAccountsStore.getState().ensureDailySnapshot()
    expect(useAccountsStore.getState().history).toEqual([{ date: today, value: 12345 }])
  })

  it('does nothing on ensureDailySnapshot when there are no accounts, so an empty install records no zero line', () => {
    useAccountsStore.setState({ accounts: [], history: [] })
    useAccountsStore.getState().ensureDailySnapshot()
    expect(useAccountsStore.getState().history).toEqual([])
  })
})
