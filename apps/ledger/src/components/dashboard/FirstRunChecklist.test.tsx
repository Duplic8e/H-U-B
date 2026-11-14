import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FirstRunChecklist } from './FirstRunChecklist'

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('FirstRunChecklist', () => {
  it('shows outstanding steps when nothing has been set up', () => {
    wrap(<FirstRunChecklist accountCount={0} transactionCount={0} />)
    expect(screen.getByText('Add your first account')).toBeInTheDocument()
    expect(screen.getByText('Import or add a transaction')).toBeInTheDocument()
  })

  it('marks a completed step and reports progress', () => {
    wrap(<FirstRunChecklist accountCount={2} transactionCount={0} />)
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
  })

  it('renders nothing once every step is done', () => {
    const { container } = wrap(<FirstRunChecklist accountCount={1} transactionCount={5} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('FirstRunChecklist dismissal', () => {
  beforeEach(() => localStorage.clear())

  it('offers a dismiss control and hides the checklist when used', () => {
    wrap(<FirstRunChecklist accountCount={0} transactionCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss getting started/i }))
    expect(screen.queryByText('Add your first account')).not.toBeInTheDocument()
  })

  it('stays dismissed on a later render', () => {
    const first = wrap(<FirstRunChecklist accountCount={0} transactionCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss getting started/i }))
    first.unmount()

    const { container } = wrap(<FirstRunChecklist accountCount={0} transactionCount={0} />)
    expect(container).toBeEmptyDOMElement()
  })
})
