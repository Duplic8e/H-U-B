import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { setDemoActive } from '../utils/demoData'
import { resetMatchMedia, setMatchMedia } from '../test-utils/matchMedia'
import { PageHeader } from './ui/PageHeader'
import { DISCLAIMER_ACK_KEY } from '../utils/disclaimer'

vi.mock('../hooks/useSWUpdate', () => ({
  useSWUpdate: () => ({
    needRefresh: false,
    refresh: () => {},
    checkStatus: 'idle',
    checkForUpdates: () => {},
  }),
}))

const { Layout } = await import('./Layout')

describe('Layout mobile chrome', () => {
  it('reserves safe-area-aware space above the tab bar and guards horizontal overflow', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const main = container.querySelector('main')!
    // padding reserves tab bar height + safe area on mobile:
    expect(main.className).toMatch(/pb-\[/) // custom bottom padding present
    expect(main.className).toMatch(/overflow-x-hidden|overflow-x-clip/)
  })
})

describe('Layout desktop sidebar', () => {
  it('has no tagline and opens the command palette from the search button', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    expect(screen.queryByText('Command Center')).not.toBeInTheDocument()
    const sidebar = container.querySelector('nav.desktop\\:flex')!
    const search = Array.from(sidebar.querySelectorAll('button')).find((b) => /search/i.test(b.textContent || ''))!
    fireEvent.click(search)
    expect(screen.getByPlaceholderText('Jump to a page or tool…')).toBeInTheDocument()
  })

  // The sidebar's vertical rule used to run to the top edge with nothing
  // meeting it, while its lower end was anchored by the settings dock border.
  // It is now a gradient that fades in from the top.
  it('draws the divider as a gradient that fades in from the top', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const sidebar = container.querySelector('nav.desktop\\:flex')!
    expect(sidebar.className).not.toMatch(/border-r border-border/)

    const divider = screen.getByTestId('sidebar-divider')
    expect(divider.getAttribute('style')).toMatch(/linear-gradient/)
    expect(divider.getAttribute('style')).toMatch(/transparent/)
    expect(divider.className).toMatch(/absolute/)
    expect(divider).toHaveAttribute('aria-hidden', 'true')
  })

  it('marks the active nav item with an accent bar', () => {
    render(<MemoryRouter><Layout /></MemoryRouter>)
    const active = screen.getAllByRole('link', { name: /dashboard/i })
      .find((l) => l.getAttribute('aria-current') === 'page')!
    expect(active.className).toMatch(/border-l-2/)
  })

  // Both axes have to be declared. CSS computes a `visible` overflow on one
  // axis to `auto` when the other is not visible, so overflow-y-auto on its
  // own quietly made the sidebar a horizontal scroll container as well. At a
  // 1.5 device pixel ratio the 1px border-r rasterises to 0.667px, clientWidth
  // lands on 255.33 against a scrollWidth that rounds to 256, and that
  // sub-pixel phantom overflow painted a real 8px scrollbar along the bottom
  // of the sidebar. Measured in a browser, not here: jsdom has no layout
  // engine, so this pins the declaration that fixes it rather than the
  // geometry, and it fails the moment either half is dropped.
  it('scrolls the sidebar vertically only, never horizontally', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const sidebar = container.querySelector('nav.desktop\\:flex')!
    expect(sidebar.className).toMatch(/\boverflow-y-auto\b/)
    expect(sidebar.className).toMatch(/\boverflow-x-hidden\b/)
  })
})

describe('Layout mobile bottom nav sizing', () => {
  it('gives every tab an equal, shrinkable, truncation-safe cell', () => {
    render(<MemoryRouter><Layout /></MemoryRouter>)
    const bar = screen.getByRole('navigation', { name: 'Primary' })
    const cells = Array.from(bar.children) as HTMLElement[]
    expect(cells.length).toBe(5) // 5 links; Settings moved to the mobile top bar
    for (const cell of cells) {
      const classes = cell.className.split(/\s+/)
      expect(classes).toContain('flex-1')
      expect(classes).toContain('min-w-0') // lets the cell shrink below its label's min-content width
    }
    // each label is truncation-safe
    const labels = bar.querySelectorAll('.truncate')
    expect(labels.length).toBe(5)
  })
})

describe('Layout nav clearance guard', () => {
  it('keeps nav clearance from being overridden by sm padding', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const main = container.querySelector('main')!
    const classes = main.className.split(/\s+/)
    expect(main.className).toMatch(/pb-\[calc\(/)      // nav-clearance retained
    expect(classes).not.toContain('sm:p-8')            // all-sides sm padding would clobber pb
    expect(classes).not.toContain('p-4')               // all-sides base padding would clobber pb too
    expect(classes).toContain('sm:px-8')               // horizontal sm padding split out
  })
})

describe('Layout document structure', () => {
  it('renders exactly one h1, owned by the page not the sidebar brand', () => {
    render(<MemoryRouter><Layout /></MemoryRouter>)
    expect(screen.queryAllByRole('heading', { level: 1, name: 'Ledger' })).toHaveLength(0)
  })

  it('offers a skip link that targets the main region', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const skip = screen.getByRole('link', { name: /skip to content/i })
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(container.querySelector('main')).toHaveAttribute('id', 'main-content')
  })
})

describe('Layout demo banner', () => {
  it('shows and hides with the demo flag without a reload', async () => {
    setDemoActive(false)
    render(<MemoryRouter><Layout /></MemoryRouter>)
    expect(screen.queryByText(/Demo data is loaded/i)).not.toBeInTheDocument()

    await act(async () => { setDemoActive(true) })
    expect(screen.getByText(/Demo data is loaded/i)).toBeInTheDocument()

    await act(async () => { setDemoActive(false) })
    expect(screen.queryByText(/Demo data is loaded/i)).not.toBeInTheDocument()
  })
})

describe('Layout landscape chrome', () => {
  it('gates the sidebar on the desktop variant, not on width alone', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const sidebar = container.querySelector('nav.desktop\\:flex')
    expect(sidebar).not.toBeNull()
    // The width-only gate must be gone, or a landscape phone loses Settings.
    expect(container.querySelector('nav.md\\:flex')).toBeNull()
  })

  it('lets the sidebar scroll so its settings dock is reachable in a short window', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const sidebar = container.querySelector('nav.desktop\\:flex')!
    expect(sidebar.className).toMatch(/overflow-y-auto/)
  })

  it('gates the bottom tab bar on the desktop variant', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    expect(container.querySelector('nav.desktop\\:hidden')).not.toBeNull()
    expect(container.querySelector('nav.md\\:hidden')).toBeNull()
  })
})

describe('Layout mobile top bar', () => {
  afterEach(() => {
    resetMatchMedia()
    localStorage.removeItem(DISCLAIMER_ACK_KEY)
  })

  it('opens the command palette from a mobile-reachable button', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const topbar = container.querySelector('[data-testid="mobile-topbar"]')!
    expect(topbar).not.toBeNull()
    expect(topbar.className).toMatch(/desktop:hidden/)
    const search = topbar.querySelector('button[aria-label="Search"]') as HTMLButtonElement
    fireEvent.click(search)
    expect(screen.getByPlaceholderText('Jump to a page or tool…')).toBeInTheDocument()
  })

  it('opens settings from the top bar', () => {
    // Seed the disclaimer ack so the disclaimer dialog isn't also open,
    // which would otherwise make the dialog role ambiguous here.
    localStorage.setItem(DISCLAIMER_ACK_KEY, new Date().toISOString())
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const topbar = container.querySelector('[data-testid="mobile-topbar"]')!
    fireEvent.click(topbar.querySelector('button[aria-label="Settings"]') as HTMLButtonElement)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('leaves the bottom bar with exactly the five routes', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const bar = container.querySelector('nav.desktop\\:hidden')!
    expect(bar.querySelectorAll('a').length).toBe(5)
    // Settings lives in the top bar now, so the bar has no buttons at all.
    expect(bar.querySelectorAll('button').length).toBe(0)
  })
})

describe('Layout route changes', () => {
  // <main> is the scroll container, not the document, so the browser never
  // resets it between routes. Measured at 375px before this fix: scrolled to
  // 1200 on Budgeting, switched to Planner, landed at 1148.
  it('starts the next route at the top of the scroll area', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/budget']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="budget" element={<Link to="/planner">to planner</Link>} />
            <Route path="planner" element={<p>planner page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    const main = container.querySelector('main')!
    main.scrollTop = 600
    fireEvent.click(screen.getByText('to planner'))
    expect(screen.getByText('planner page')).toBeInTheDocument()
    expect(main.scrollTop).toBe(0)
  })
})

describe('Layout top bar slot', () => {
  afterEach(() => resetMatchMedia())

  it('carries the page title and main action on a phone, with the wordmark wrapper beside it', () => {
    setMatchMedia(false)
    const { container } = render(
      <MemoryRouter initialEntries={['/budget']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route
              path="budget"
              element={<PageHeader title="Budgeting" phoneAction={<button type="button" aria-label="Add Transaction">+</button>} />}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    const topbar = container.querySelector('[data-testid="mobile-topbar"]')!
    expect(topbar.querySelector('[data-topbar-slot] [data-testid="topbar-title"]')).toHaveTextContent('Budgeting')
    expect(topbar.querySelector('[data-topbar-slot] button[aria-label="Add Transaction"]')).not.toBeNull()
    expect(topbar.querySelector('[data-topbar-brand]')).not.toBeNull()
    expect(container.querySelector('main h1')).toHaveClass('sr-only')
  })
})
