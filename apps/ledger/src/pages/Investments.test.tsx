import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Investments } from './Investments'
import { resetMatchMedia, setMatchMedia } from '../test-utils/matchMedia'
import { useAnalysisStore } from '../store/useAnalysisStore'

const analysisInitial = useAnalysisStore.getState()

beforeEach(() => {
  useAnalysisStore.setState(analysisInitial, true)
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <Investments />
    </MemoryRouter>,
  )

describe('Investments page', () => {
  it('opens on the journal tab with an empty state', () => {
    useAnalysisStore.setState({ analyses: [] })
    renderPage()
    expect(screen.getByText('No analyses yet')).toBeInTheDocument()
    // One button in the header, one in the empty state action.
    expect(screen.getAllByRole('button', { name: /New Analysis/ })).toHaveLength(2)
  })

  it('describes each tab as it is selected', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Portfolio' }))
    expect(screen.getByText('Your portfolio with live prices and allocations.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Options' }))
    expect(screen.getByText(/Wheel strategy/)).toBeInTheDocument()
  })

  it('hides the New Analysis button outside the journal tab', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Portfolio' }))
    expect(screen.queryByRole('button', { name: /New Analysis/ })).not.toBeInTheDocument()
  })

  it('shows zeroed totals with no analyses recorded', () => {
    useAnalysisStore.setState({ analyses: [] })
    renderPage()
    expect(screen.getByText('Total Planned')).toBeInTheDocument()
    expect(screen.getByText('Current Value')).toBeInTheDocument()
    // formatMoney(0) renders as "$0"; all three stat cards (Total Planned,
    // Actually Invested, Current Value) should show it with no analyses.
    expect(screen.getAllByText('$0')).toHaveLength(3)
  })

  it('opens the Trades tab', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Trades' }))
    expect(screen.getByText('Record a trade')).toBeInTheDocument()
  })
})

describe('Investments header on a phone', () => {
  afterEach(() => resetMatchMedia())

  it('swaps the phone action with the tab and keeps the desktop names', () => {
    setMatchMedia(false)
    useAnalysisStore.setState({ analyses: [] })
    renderPage()
    // The header's phone action plus the empty state's own button.
    expect(screen.getAllByRole('button', { name: 'New Analysis' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('tab', { name: 'Portfolio' }))
    expect(screen.getAllByRole('button', { name: 'Import Holdings' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Trades' }))
    expect(screen.queryByRole('button', { name: 'Import Holdings' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New Analysis' })).toBeNull()
  })
})
