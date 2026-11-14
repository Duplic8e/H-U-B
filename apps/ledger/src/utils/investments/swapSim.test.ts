import { describe, expect, it } from 'vitest'
import { simulateSwap } from './swapSim'

describe('simulateSwap', () => {
  it('reproduces the sheet: NVTS -> GFS on $2500', () => {
    // NVTS bought at 19.67 now 14.46 -> -662.18; GFS 19.67->? sheet shows +73.70 new return
    const r = simulateSwap(2500, 19.67, 14.46, 55, 56.62)
    expect(r.originalReturn).toBeCloseTo(2500 * (14.46 / 19.67 - 1), 1) // ~ -662.18
    expect(r.newReturn).toBeCloseTo(2500 * (56.62 / 55 - 1), 1)
    expect(r.difference).toBeCloseTo(r.newReturn - r.originalReturn, 6)
  })
  it('zero start prices return zeros instead of Infinity', () => {
    const r = simulateSwap(1000, 0, 10, 0, 10)
    expect(r.originalReturn).toBe(0)
    expect(r.newReturn).toBe(0)
  })
})
