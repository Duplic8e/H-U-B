import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { useDocumentTitle } from './useDocumentTitle'

const wrapperFor = (path: string) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(MemoryRouter, { initialEntries: [path] }, children)

describe('useDocumentTitle', () => {
  it('names the dashboard route', () => {
    const { result } = renderHook(() => useDocumentTitle(), { wrapper: wrapperFor('/') })
    expect(document.title).toBe('Dashboard - Ledger')
    expect(result.current).toBe('Dashboard')
  })

  it('names a top-level route', () => {
    renderHook(() => useDocumentTitle(), { wrapper: wrapperFor('/budget') })
    expect(document.title).toBe('Budgeting - Ledger')
  })

  it('names a planner tool from the registry', () => {
    renderHook(() => useDocumentTitle(), { wrapper: wrapperFor('/planner/mortgage') })
    expect(document.title).toBe('Mortgage - Ledger')
  })

  it('falls back to the bare app name for an unknown route', () => {
    renderHook(() => useDocumentTitle(), { wrapper: wrapperFor('/nope') })
    expect(document.title).toBe('Ledger')
  })
})
