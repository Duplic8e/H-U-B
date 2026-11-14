import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTakeHomeEstimate } from './useTakeHomeEstimate'
import { usePlannerStore } from '../store/usePlannerStore'
import { takeHomeWithDeductions } from '../utils/finance/canadaTax'

beforeEach(() => {
  usePlannerStore.setState({ inputs: {} })
})

describe('useTakeHomeEstimate', () => {
  it('defaults to Ontario with zero deductions', () => {
    const { result } = renderHook(() => useTakeHomeEstimate(100_000))
    expect(result.current.province).toBe('ON')
    expect(result.current.takeHome.net).toBe(takeHomeWithDeductions(100_000, 'ON', 0, 0).net)
  })

  it('reuses the province saved in the salary-tax tool, ignoring its rrsp/fhsa', () => {
    usePlannerStore.setState({ inputs: { 'salary-tax': { province: 'BC', rrsp: 10_000, fhsa: 8_000 } } })
    const { result } = renderHook(() => useTakeHomeEstimate(100_000))
    expect(result.current.province).toBe('BC')
    expect(result.current.takeHome.net).toBe(takeHomeWithDeductions(100_000, 'BC', 0, 0).net)
  })

  it('falls back to ON for an invalid saved province and returns 0 pct at 0 gross', () => {
    usePlannerStore.setState({ inputs: { 'salary-tax': { province: 'XX' } } })
    const { result } = renderHook(() => useTakeHomeEstimate(0))
    expect(result.current.province).toBe('ON')
    expect(result.current.deductionPct).toBe(0)
  })
})
