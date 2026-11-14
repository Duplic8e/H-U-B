import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stat } from './Stat'

describe('Stat', () => {
  it('renders label, value and tone class', () => {
    render(<Stat label="Total fund" value="$27,000" tone="accent" />)
    expect(screen.getByText('Total fund')).toBeTruthy()
    expect(screen.getByText('$27,000').className).toContain('text-accent')
  })
})
