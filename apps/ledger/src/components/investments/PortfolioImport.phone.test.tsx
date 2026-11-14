import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PortfolioImport } from './PortfolioImport'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

afterEach(() => resetMatchMedia())

describe('PortfolioImport on a phone', () => {
  it('lays the import out as three steps, with what each mode does under its name', () => {
    setMatchMedia(false)
    render(<PortfolioImport />)
    expect(screen.getByText('Pick the Account')).toBeInTheDocument()
    expect(screen.getByText('Choose What Happens')).toBeInTheDocument()
    expect(screen.getByText('Choose the File')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Replace/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: /Update/ }))
    expect(screen.getByRole('radio', { name: /Update/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Merges by ticker. Other rows stay as they are.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import Broker CSV' })).toBeInTheDocument()
  })

  it('keeps the single row of controls on desktop', () => {
    setMatchMedia(true)
    render(<PortfolioImport />)
    expect(screen.queryByText('Pick the Account')).toBeNull()
    expect(screen.getByRole('button', { name: /Import broker CSV/ })).toBeInTheDocument()
  })
})
