import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartLegend } from './ChartLegend'

describe('ChartLegend', () => {
  it('names every series with its value', () => {
    render(<ChartLegend items={[
      { name: 'Base Salary', color: '#111', value: '$165,000' },
      { name: 'RSUs', color: '#222', value: '$120,000' },
    ]} />)
    expect(screen.getByText(/Base Salary/)).toBeInTheDocument()
    expect(screen.getByText(/\$165,000/)).toBeInTheDocument()
    expect(screen.getByText(/RSUs/)).toBeInTheDocument()
  })

  it('renders without a value', () => {
    render(<ChartLegend items={[{ name: 'Median', color: '#111' }]} />)
    expect(screen.getByText('Median')).toBeInTheDocument()
  })

  it('hides the swatches from assistive technology, since the name carries the meaning', () => {
    const { container } = render(<ChartLegend items={[{ name: 'Median', color: '#111' }]} />)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
  })
})
