import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlannerGoalWidget } from './PlannerGoalWidget'
import { usePlannerStore } from '../../../store/usePlannerStore'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { useAccountFxStore } from '../../../store/useAccountFxStore'
import { setMatchMedia, resetMatchMedia } from '../../../test-utils/matchMedia'

const plannerInitial = usePlannerStore.getState()
const accountsInitial = useAccountsStore.getState()

beforeEach(() => {
  usePlannerStore.setState(plannerInitial, true)
  useAccountsStore.setState(accountsInitial, true)
  useAccountFxStore.setState({ resolved: undefined, loading: false, error: undefined })
})

const renderWidget = () =>
  render(
    <MemoryRouter>
      <PlannerGoalWidget />
    </MemoryRouter>,
  )

const setGoals = (goalsJson: string) => {
  usePlannerStore.setState({ inputs: { forecaster: { goalsJson } } })
}

describe('PlannerGoalWidget', () => {
  it('points at the Forecaster when there is no goal', () => {
    renderWidget()
    expect(screen.getByRole('link', { name: 'Add a Goal' })).toHaveAttribute(
      'href',
      '/planner/forecaster',
    )
  })

  it('shows the largest goal and progress toward it', () => {
    setGoals(JSON.stringify([{ id: 'g1', label: 'House', amount: 200000 }, { id: 'g2', label: 'Car', amount: 40000 }]))
    useAccountsStore.setState({ accounts: [{ id: 'a', name: 'Brokerage', value: 100000, type: 'investment', currency: 'CAD' }] })
    renderWidget()
    expect(screen.getByText('House')).toBeInTheDocument()
    expect(screen.getByText('$100,000 of $200,000 (50%)')).toBeInTheDocument()
  })

  it('falls back to the empty state on malformed goal data instead of crashing', () => {
    setGoals('{not json')
    renderWidget()
    expect(screen.getByRole('link', { name: 'Add a Goal' })).toBeInTheDocument()
  })

  it('uses converted CAD net worth to calculate goal progress', () => {
    setGoals(JSON.stringify([{ id: 'g1', label: 'House', amount: 200 }]))
    useAccountsStore.setState({ accounts: [{ id: 'usd', name: 'US bank', value: 100, type: 'bank', currency: 'USD' }] })
    useAccountFxStore.setState({ resolved: { value: { from: 'USD', to: 'CAD', rate: 1.5, date: '2026-10-06', asOf: '2026-10-06T00:00:00Z' }, source: 'live', status: 'success', asOf: '2026-10-06T00:00:00Z', stale: false } })
    renderWidget()
    expect(screen.getByText('$150 of $200 (75%)')).toBeInTheDocument()
  })

  it('keeps the goal and target visible without progress while conversion is unavailable', () => {
    setGoals(JSON.stringify([{ id: 'g1', label: 'House', amount: 200000 }]))
    useAccountsStore.setState({ accounts: [{ id: 'usd', name: 'USD bank', value: 100, type: 'bank', currency: 'USD' }] })
    renderWidget()
    expect(screen.getByText('House')).toBeInTheDocument()
    expect(screen.getByText('Target $200,000')).toBeInTheDocument()
    expect(screen.getByText(/Conversion Needed/)).toBeInTheDocument()
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument()
  })

  describe('on a phone', () => {
    beforeEach(() => setMatchMedia(false))
    afterEach(() => resetMatchMedia())

    it('shows the name and percent, a bar, and Now, Left and Goal', () => {
      setGoals(JSON.stringify([{ id: 'g1', label: 'House', amount: 200000 }]))
      useAccountsStore.setState({ accounts: [{ id: 'a', name: 'Brokerage', value: 50000, type: 'investment', currency: 'CAD' }] })
      renderWidget()
      expect(screen.getByText('House')).toBeInTheDocument()
      expect(screen.getByText('25%')).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: 'House progress' })).toHaveAttribute('aria-valuenow', '25')
      expect(screen.getByText('Now').nextSibling).toHaveTextContent('$50,000')
      expect(screen.getByText('Left').nextSibling).toHaveTextContent('$150,000')
      expect(screen.getByText('Goal').nextSibling).toHaveTextContent('$200,000')
      expect(screen.getByRole('link', { name: /View All/ })).toHaveAttribute('href', '/planner/forecaster')
    })

    it('puts the explanation behind an info button and counts the other goals', () => {
      setGoals(JSON.stringify([{ id: 'g1', label: 'House', amount: 200000 }, { id: 'g2', label: 'Car', amount: 40000 }, { id: 'g3', label: 'Trip', amount: 5000 }]))
      useAccountsStore.setState({ accounts: [{ id: 'a', name: 'Brokerage', value: 50000, type: 'investment', currency: 'CAD' }] })
      renderWidget()
      expect(screen.getByRole('button', { name: 'About Top Goal' })).toBeInTheDocument()
      expect(screen.getByText('+ 2 More Goals')).toBeInTheDocument()
    })

    it('shows nothing left once the goal is reached', () => {
      setGoals(JSON.stringify([{ id: 'g1', label: 'Car', amount: 40000 }]))
      useAccountsStore.setState({ accounts: [{ id: 'a', name: 'Brokerage', value: 50000, type: 'investment', currency: 'CAD' }] })
      renderWidget()
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('Left').nextSibling).toHaveTextContent('$0')
    })
  })
})
