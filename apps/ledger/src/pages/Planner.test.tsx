import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PLANNER_TOOLS } from '../components/planner/toolRegistry'
import { Planner } from './Planner'
import { PlannerTool } from './PlannerTool'
import { resetMatchMedia, setMatchMedia } from '../test-utils/matchMedia'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/planner" element={<Planner />} />
        <Route path="/planner/:toolId" element={<PlannerTool />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Planner hub', () => {
  it('renders the heading and one tile per registered tool', () => {
    renderAt('/planner')
    expect(screen.getByRole('heading', { name: 'Planner' })).toBeInTheDocument()
    for (const tool of PLANNER_TOOLS) {
      expect(screen.getByText(tool.name)).toBeInTheDocument()
    }
  })

  it('tiles link to /planner/:toolId', () => {
    renderAt('/planner')
    const first = PLANNER_TOOLS[0]
    expect(screen.getByRole('link', { name: new RegExp(first.name) })).toHaveAttribute(
      'href',
      `/planner/${first.id}`
    )
  })
})

describe('Planner hub on a phone', () => {
  afterEach(() => resetMatchMedia())

  it('lists every tool by name as a link, without the descriptions', () => {
    setMatchMedia(false)
    renderAt('/planner')
    for (const tool of PLANNER_TOOLS) {
      expect(screen.getByRole('link', { name: tool.name })).toHaveAttribute('href', `/planner/${tool.id}`)
      expect(screen.queryByText(tool.description)).not.toBeInTheDocument()
    }
  })

  it('keeps the descriptions on desktop', () => {
    renderAt('/planner')
    expect(screen.getByText(PLANNER_TOOLS[0].description)).toBeInTheDocument()
  })
})

describe('PlannerTool route', () => {
  it('renders the tool page with a back link', () => {
    renderAt(`/planner/${PLANNER_TOOLS[0].id}`)
    expect(screen.getByRole('heading', { name: PLANNER_TOOLS[0].name })).toBeInTheDocument()
    expect(screen.getByLabelText('Back to Planner')).toHaveAttribute('href', '/planner')
  })

  it('redirects unknown tool ids back to the hub', () => {
    renderAt('/planner/not-a-tool')
    expect(screen.getByRole('heading', { name: 'Planner' })).toBeInTheDocument()
  })

  it('switches tools through the breadcrumb dropdown', () => {
    renderAt(`/planner/${PLANNER_TOOLS[0].id}`)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(PLANNER_TOOLS[0].name) }))
    const target = PLANNER_TOOLS[1]
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(target.name) }))
    expect(screen.getByRole('heading', { name: target.name })).toBeInTheDocument()
  })
})

describe('Planner page gutter (no double padding)', () => {
  it('root does not add its own p-6 padding (main owns the gutter)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/planner']}>
        <Routes>
          <Route path="/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>
    )
    const root = container.firstChild as HTMLElement
    expect(root.className.split(/\s+/)).not.toContain('p-6')
  })
})
