import { describe, expect, it } from 'vitest'
import { computeWindow } from './virtualWindow'

const base = { rowHeight: 48, viewportHeight: 480, totalRows: 1000, overscan: 5 }

describe('computeWindow', () => {
  it('starts at the top with overscan clamped to zero', () => {
    const r = computeWindow({ ...base, scrollTop: 0 })
    expect(r.startIndex).toBe(0)
    expect(r.padTop).toBe(0)
    expect(r.endIndex).toBe(15)
  })

  it('windows around the scroll position', () => {
    const r = computeWindow({ ...base, scrollTop: 4800 })
    expect(r.startIndex).toBe(95)
    expect(r.endIndex).toBe(115)
    expect(r.padTop).toBe(95 * 48)
  })

  it('clamps the end to the row count and pads the bottom to zero', () => {
    const r = computeWindow({ ...base, scrollTop: 1000 * 48 })
    expect(r.endIndex).toBe(1000)
    expect(r.padBottom).toBe(0)
  })

  it('renders everything when the list is shorter than the viewport', () => {
    const r = computeWindow({ ...base, totalRows: 3, scrollTop: 0 })
    expect(r.startIndex).toBe(0)
    expect(r.endIndex).toBe(3)
    expect(r.padTop).toBe(0)
    expect(r.padBottom).toBe(0)
  })

  it('renders everything when the viewport height is unknown', () => {
    const r = computeWindow({ ...base, viewportHeight: 0, scrollTop: 0 })
    expect(r.startIndex).toBe(0)
    expect(r.endIndex).toBe(1000)
  })
})
