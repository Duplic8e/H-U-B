import { SingleFlight, minInterval, __resetMinInterval } from './throttle'

describe('SingleFlight', () => {
  it('collapses concurrent calls for the same key into one execution', async () => {
    const sf = new SingleFlight()
    let calls = 0
    const fn = () => { calls++; return new Promise<number>((r) => setTimeout(() => r(42), 10)) }
    const [a, b] = await Promise.all([sf.run('k', fn), sf.run('k', fn)])
    expect(a).toBe(42)
    expect(b).toBe(42)
    expect(calls).toBe(1)
  })

  it('allows a new execution after the previous settles', async () => {
    const sf = new SingleFlight()
    let calls = 0
    const fn = async () => { calls++; return calls }
    expect(await sf.run('k', fn)).toBe(1)
    expect(await sf.run('k', fn)).toBe(2)
  })

  it('cleans up map on rejection and allows subsequent success', async () => {
    const sf = new SingleFlight()
    let calls = 0
    const errorFn = () => {
      calls++
      return new Promise<number>((_, rej) => setTimeout(() => rej(new Error('test error')), 1))
    }
    const okFn = async () => { calls++; return 42 }

    const results = await Promise.allSettled([sf.run('k', errorFn), sf.run('k', errorFn)])
    expect(results[0].status).toBe('rejected')
    expect(results[1].status).toBe('rejected')
    expect(results[0]).toEqual(results[1])
    expect(calls).toBe(1)

    const okResult = await sf.run('k', okFn)
    expect(okResult).toBe(42)
    expect(calls).toBe(2)
  })
})

describe('minInterval', () => {
  beforeEach(() => {
    __resetMinInterval()
  })

  it('allows first call, blocks a call within the window, allows after it', () => {
    expect(minInterval('sym', 1000, 0)).toBe(true)
    expect(minInterval('sym', 1000, 500)).toBe(false)
    expect(minInterval('sym', 1000, 1000)).toBe(true)
  })

  it('isolates rate limiting per key', () => {
    expect(minInterval('a', 10000, 0)).toBe(true)
    expect(minInterval('b', 10000, 0)).toBe(true)
    expect(minInterval('a', 10000, 0)).toBe(false)
    expect(minInterval('b', 10000, 0)).toBe(false)
  })
})
