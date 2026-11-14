import { render, screen, fireEvent } from '@testing-library/react'
import { DataFreshness } from './DataFreshness'

describe('DataFreshness', () => {
  const now = new Date('2026-08-14T12:00:00Z')

  it('names a live figure and its age', () => {
    render(<DataFreshness source="live" asOf="2026-08-14T11:55:00Z" stale={false} now={now} />)
    expect(screen.getByText('Live · 5 min ago')).toBeInTheDocument()
  })

  it('marks a stale cached figure', () => {
    render(<DataFreshness source="cache" asOf="2026-08-12T12:00:00Z" stale now={now} />)
    expect(screen.getByText('Cached · 2 days ago · stale')).toBeInTheDocument()
  })

  it('names a manual override', () => {
    render(<DataFreshness source="override" asOf="2026-08-14T11:59:50Z" stale={false} now={now} />)
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('offers a refresh control only when a handler is given', () => {
    const { rerender } = render(<DataFreshness source="cache" asOf="2026-08-14T11:00:00Z" stale now={now} />)
    expect(screen.queryByLabelText('Refresh price')).toBeNull()

    const onRefresh = vi.fn()
    rerender(<DataFreshness source="cache" asOf="2026-08-14T11:00:00Z" stale now={now} onRefresh={onRefresh} label="price" />)
    fireEvent.click(screen.getByLabelText('Refresh price'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
