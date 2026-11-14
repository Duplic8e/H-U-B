import { fireEvent, render, screen } from '@testing-library/react'
import { ShowMoreButton } from './ShowMoreButton'

describe('ShowMoreButton', () => {
  it('names the full count while collapsed and calls onToggle', () => {
    const onToggle = vi.fn()
    render(<ShowMoreButton total={8} noun="sources" expanded={false} onToggle={onToggle} controls="list-1" />)
    const button = screen.getByRole('button', { name: 'Show all 8 sources' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'list-1')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('offers to collapse once expanded', () => {
    render(<ShowMoreButton total={8} noun="sources" expanded onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true')
  })
})
