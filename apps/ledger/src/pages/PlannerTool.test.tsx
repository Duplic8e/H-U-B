import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlannerTool } from './PlannerTool'
import { getTool } from '../components/planner/toolRegistry'
import { TopBarSlotContext } from '../components/topBarSlot'
import { resetMatchMedia, setMatchMedia } from '../test-utils/matchMedia'
import { resetToolIntroMemory } from '../utils/toolIntroSeen'

const tool = getTool('mortgage')!

function renderTool(slot: HTMLElement | null) {
  return render(
    <TopBarSlotContext.Provider value={slot}>
      <MemoryRouter initialEntries={[`/planner/${tool.id}`]}>
        <Routes>
          <Route path="/planner" element={<div>Planner hub</div>} />
          <Route path="/planner/:toolId" element={<PlannerTool />} />
        </Routes>
      </MemoryRouter>
    </TopBarSlotContext.Provider>
  )
}

describe('PlannerTool header on a phone', () => {
  const slots: HTMLElement[] = []
  beforeEach(() => {
    localStorage.clear()
    resetToolIntroMemory()
  })
  afterEach(() => {
    resetMatchMedia()
    slots.forEach((el) => el.remove())
    slots.length = 0
  })

  function mountSlot() {
    const slot = document.createElement('div')
    document.body.appendChild(slot)
    slots.push(slot)
    return slot
  }

  it('puts a back button and the tool switcher in the top bar slot', () => {
    setMatchMedia(false)
    const slot = mountSlot()
    renderTool(slot)
    const back = within(slot).getByRole('button', { name: 'Back to Planner' })
    expect(back.className).toMatch(/min-h-\[44px\]/)
    expect(back.className).toMatch(/min-w-\[44px\]/)
    const switcher = within(slot).getByRole('button', { name: new RegExp(tool.name) })
    expect(switcher).toHaveAttribute('aria-haspopup', 'menu')
    expect(switcher).toHaveAttribute('aria-expanded', 'false')
    expect(switcher.className).toMatch(/truncate|min-w-0/)
  })

  it('navigates to the hub from the back button', () => {
    setMatchMedia(false)
    const slot = mountSlot()
    renderTool(slot)
    fireEvent.click(within(slot).getByRole('button', { name: 'Back to Planner' }))
    expect(screen.getByText('Planner hub')).toBeInTheDocument()
  })

  it('keeps one visually hidden h1 in the page and no breadcrumb', () => {
    setMatchMedia(false)
    const slot = mountSlot()
    const { container } = renderTool(slot)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent(tool.name)
    expect(h1s[0].className).toContain('sr-only')
    expect(container.textContent).not.toContain('Planner /')
    expect(within(container).queryByText('Planner')).toBeNull()
    expect(within(container).queryByText('/')).toBeNull()
  })

  it('keeps the info content reachable through the first-visit notice button', () => {
    setMatchMedia(false)
    const slot = mountSlot()
    const { container } = renderTool(slot)
    const info = within(container).getAllByRole('button', { name: /Tool Overview/ })[0]
    expect(info.className).toMatch(/min-h-\[44px\]/)
    fireEvent.click(info)
    expect(screen.getByTestId('sheet-panel')).toHaveTextContent(tool.info.howTo)
  })

  it('falls back to an in-page compact header with no slot', () => {
    setMatchMedia(false)
    const { container } = renderTool(null)
    expect(within(container).getByRole('button', { name: 'Back to Planner' })).toBeInTheDocument()
    expect(within(container).getByRole('button', { name: new RegExp(tool.name) })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

describe('PlannerTool header on desktop', () => {
  it('keeps the breadcrumb, title dropdown and info icon', () => {
    const { container } = renderTool(null)
    const link = screen.getByRole('link', { name: 'Back to Planner' })
    expect(link).toHaveAttribute('href', '/planner')
    expect(link).toHaveTextContent('Planner')
    const h1 = screen.getByRole('heading', { level: 1, name: tool.name })
    expect(h1.className).toContain('text-[24px]')
    expect(h1.className).not.toContain('sr-only')
    expect(container.querySelector('header')).not.toBeNull()
    expect(screen.getByRole('button', { name: /Tool Overview/ })).toBeInTheDocument()
  })
})

describe('PlannerTool tool-overview on a phone', () => {
  const sentence = 'New Here? Read the Tool Overview'
  beforeEach(() => {
    localStorage.clear()
    resetToolIntroMemory()
    setMatchMedia(false)
  })
  afterEach(() => resetMatchMedia())

  it('shows the first-visit notice with a Dismiss button', () => {
    renderTool(null)
    expect(screen.getByText(sentence)).toBeInTheDocument()
    const gotIt = screen.getByRole('button', { name: 'Dismiss' })
    expect(gotIt.className).toMatch(/min-h-\[44px\]/)
    expect(screen.getAllByRole('button', { name: /Tool Overview/ })).toHaveLength(2)
  })

  it('does not return after Dismiss, on remount, but still shows for another tool', () => {
    const first = renderTool(null)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(sentence)).toBeNull()
    first.unmount()
    const second = renderTool(null)
    expect(screen.queryByText(sentence)).toBeNull()
    second.unmount()
    render(
      <MemoryRouter initialEntries={['/planner/savings-goal']}>
        <Routes>
          <Route path="/planner/:toolId" element={<PlannerTool />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText(sentence)).toBeInTheDocument()
  })

  it('opening the info marks the tool as seen', () => {
    const first = renderTool(null)
    fireEvent.click(screen.getAllByRole('button', { name: /Tool Overview/ })[0])
    expect(screen.getByTestId('sheet-panel')).toHaveTextContent(tool.info.howTo)
    first.unmount()
    renderTool(null)
    expect(screen.queryByText(sentence)).toBeNull()
  })

  it('always has one centred Tool Overview button after the results', () => {
    renderTool(null)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    const buttons = screen.getAllByRole('button', { name: /Tool Overview/ })
    expect(buttons).toHaveLength(1)
    const bottom = buttons[0]
    expect(bottom.className).toMatch(/min-h-\[44px\]/)
    expect(bottom.className).toMatch(/text-accent/)
    expect(bottom.parentElement!.className).toMatch(/justify-center/)
    const all = Array.from(document.querySelectorAll('button'))
    expect(all[all.length - 1]).toBe(bottom)
    fireEvent.click(bottom)
    expect(screen.getByTestId('sheet-panel')).toHaveTextContent(tool.info.howTo)
  })
})

describe('PlannerTool tool-overview focus on a phone', () => {
  beforeEach(() => {
    localStorage.clear()
    resetToolIntroMemory()
    setMatchMedia(false)
  })
  afterEach(() => resetMatchMedia())

  const bottomButton = () => {
    const all = screen.getAllByRole('button', { name: /Tool Overview/ })
    return all[all.length - 1]
  }

  it('moves focus to the bottom button after Dismiss', () => {
    renderTool(null)
    const gotIt = screen.getByRole('button', { name: 'Dismiss' })
    gotIt.focus()
    fireEvent.click(gotIt)
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
    expect(document.activeElement).toBe(bottomButton())
  })

  it('moves focus to the bottom button after the info sheet opened from the notice closes', async () => {
    renderTool(null)
    const fromNotice = screen.getAllByRole('button', { name: /Tool Overview/ })[0]
    fromNotice.focus()
    fireEvent.click(fromNotice)
    expect(screen.getByTestId('sheet-panel')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
    expect(document.activeElement).toBe(bottomButton())
  })
})

describe('PlannerTool tool-overview on desktop', () => {
  it('has no notice and no bottom button', () => {
    localStorage.clear()
    resetToolIntroMemory()
    renderTool(null)
    expect(screen.queryByText(/New Here/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /Tool Overview/ })).toHaveLength(1)
  })
})
