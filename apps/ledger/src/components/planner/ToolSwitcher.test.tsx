import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToolSwitcher } from './ToolSwitcher'
import { getTool } from './toolRegistry'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

describe('ToolSwitcher', () => {
  afterEach(() => {
    resetMatchMedia()
    navigateMock.mockClear()
  })

  it('opens a popover listing planner tools on click', () => {
    const current = getTool('mortgage')!
    render(
      <MemoryRouter>
        <ToolSwitcher current={current} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /mortgage/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('navigates to a different tool on menu item click', () => {
    const current = getTool('mortgage')!
    render(
      <MemoryRouter>
        <ToolSwitcher current={current} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /mortgage/i }))
    const other = getTool('debt-payoff') ?? getTool('compound-interest')
    expect(other).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(other!.name, 'i') }))
    expect(navigateMock).toHaveBeenCalledWith(`/planner/${other!.id}`)
  })

  it('opens a bottom sheet on mobile and closes via scrim', async () => {
    setMatchMedia(false)
    const current = getTool('mortgage')!
    const { getByTestId, queryByTestId } = render(
      <MemoryRouter>
        <ToolSwitcher current={current} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /mortgage/i }))
    expect(getByTestId('sheet-panel')).toBeInTheDocument()
    fireEvent.click(getByTestId('sheet-scrim'))
    await waitFor(() => expect(queryByTestId('sheet-panel')).toBeNull())
  })

  it('has no visible Close row in the phone sheet', () => {
    setMatchMedia(false)
    const current = getTool('mortgage')!
    render(
      <MemoryRouter>
        <ToolSwitcher current={current} phone />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /mortgage/i }))
    expect(screen.getByTestId('sheet-panel')).toBeInTheDocument()
    for (const btn of screen.queryAllByRole('button', { name: 'Close' })) {
      expect(btn).toHaveAttribute('data-sheet-hidden-close')
      expect(btn.className.split(' ')).toContain('sr-only')
    }
  })
})
