import { useTradesStore } from './useTradesStore'
import { STORAGE_KEYS } from './storageKeys'

const initialState = useTradesStore.getState()

beforeEach(() => {
  useTradesStore.setState(initialState, true)
})

describe('useTradesStore', () => {
  it('starts empty', () => {
    expect(useTradesStore.getState().trades).toEqual([])
  })

  it('adds a trade with a generated id', () => {
    useTradesStore.getState().addTrade({
      date: '2026-03-02', ticker: 'VFV', account: 'RRSP', side: 'buy',
      quantity: 10, price: 120, fees: 4.95, currency: 'CAD',
    })
    const [t] = useTradesStore.getState().trades
    expect(t.id).toBeTruthy()
    expect(t.ticker).toBe('VFV')
  })

  it('uppercases and trims the ticker so VFV and " vfv " are one security', () => {
    useTradesStore.getState().addTrade({
      date: '2026-03-02', ticker: ' vfv ', account: 'RRSP', side: 'buy',
      quantity: 1, price: 1, fees: 0, currency: 'CAD',
    })
    expect(useTradesStore.getState().trades[0].ticker).toBe('VFV')
  })

  it('removes a trade by id', () => {
    useTradesStore.getState().addTrade({
      date: '2026-03-02', ticker: 'VFV', account: 'RRSP', side: 'buy',
      quantity: 1, price: 1, fees: 0, currency: 'CAD',
    })
    useTradesStore.getState().removeTrade(useTradesStore.getState().trades[0].id)
    expect(useTradesStore.getState().trades).toEqual([])
  })

  it('is registered for backup', () => {
    expect(STORAGE_KEYS.trades).toBe('ledger-trades')
  })

  it('stores positive quantity, price and fees even when handed negative ones, so downstream cost-base and realized-gain figures cannot be silently corrupted by sign', () => {
    useTradesStore.getState().addTrade({
      date: '2026-03-02', ticker: 'VFV', account: 'RRSP', side: 'buy',
      quantity: -10, price: -120, fees: -4.95, currency: 'CAD',
    })
    const [t] = useTradesStore.getState().trades
    expect(t.quantity).toBe(10)
    expect(t.price).toBe(120)
    expect(t.fees).toBe(4.95)
  })

  it('empties a store holding multiple trades', () => {
    useTradesStore.getState().addTrade({
      date: '2026-03-02', ticker: 'VFV', account: 'RRSP', side: 'buy',
      quantity: 1, price: 1, fees: 0, currency: 'CAD',
    })
    useTradesStore.getState().addTrade({
      date: '2026-03-03', ticker: 'XEQT', account: 'TFSA', side: 'sell',
      quantity: 2, price: 2, fees: 0, currency: 'CAD',
    })
    expect(useTradesStore.getState().trades.length).toBe(2)
    useTradesStore.getState().clearTrades()
    expect(useTradesStore.getState().trades).toEqual([])
  })
})
