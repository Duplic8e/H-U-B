import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemedDatePicker } from './ThemedDatePicker'
import { setMatchMedia } from '../../test-utils/matchMedia'

describe('ThemedDatePicker', () => {
  it('shows the value and opens a calendar grid', () => {
    render(<ThemedDatePicker value="2026-07-05" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /2026-07-05/ }))
    expect(screen.getByRole('grid')).toBeTruthy()
    expect(screen.getByText('July 2026')).toBeTruthy()
  })

  it('selects a day and emits YYYY-MM-DD', () => {
    const onChange = vi.fn()
    render(<ThemedDatePicker value="2026-07-05" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /2026-07-05/ }))
    fireEvent.click(screen.getByRole('gridcell', { name: '14' }))
    expect(onChange).toHaveBeenCalledWith('2026-07-14')
  })

  it('navigates months', () => {
    render(<ThemedDatePicker value="2026-07-05" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /2026-07-05/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('June 2026')).toBeTruthy()
  })

  it('renders no overlay backdrop when open', () => {
    render(<ThemedDatePicker value="2026-07-05" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /2026-07-05/ }))
    expect(screen.getByRole('grid')).toBeTruthy()
    expect(screen.queryByTestId('overlay-backdrop')).toBeNull()
  })

  it('opens as a sheet on mobile and selects a day', async () => {
    setMatchMedia(false)
    const onChange = vi.fn()
    const { getByRole, getByTestId, queryByTestId } = render(
      <ThemedDatePicker value="2026-07-05" onChange={onChange} />
    )
    fireEvent.click(getByRole('button', { name: /2026-07-05/ }))
    const panel = getByTestId('sheet-panel')
    expect(panel).toBeInTheDocument()
    expect(getByRole('grid')).toBeTruthy()
    fireEvent.click(getByRole('gridcell', { name: '14' }))
    expect(onChange).toHaveBeenCalledWith('2026-07-14')
    await waitFor(() => expect(queryByTestId('sheet-panel')).toBeNull())
  })

  it('navigates months inside the mobile sheet without closing it', () => {
    setMatchMedia(false)
    const { getByRole, getByTestId, queryByTestId, getByText } = render(
      <ThemedDatePicker value="2026-07-05" onChange={() => {}} />
    )
    fireEvent.click(getByRole('button', { name: /2026-07-05/ }))
    expect(getByTestId('sheet-panel')).toBeInTheDocument()
    expect(getByText('July 2026')).toBeTruthy()

    const nextButton = getByRole('button', { name: 'Next month' })
    // Real browsers fire pointerdown before click; the outside-click-to-close
    // effect must not treat a tap inside the portaled sheet as "outside".
    fireEvent.pointerDown(nextButton)
    fireEvent.click(nextButton)

    expect(queryByTestId('sheet-panel')).not.toBeNull()
    expect(getByText('August 2026')).toBeTruthy()
  })
})
