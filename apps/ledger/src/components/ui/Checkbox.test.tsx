import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('renders an accessible checkbox that reports its checked state', () => {
    render(<Checkbox checked onChange={() => {}} ariaLabel="Select transaction" />)
    const box = screen.getByRole('checkbox', { name: 'Select transaction' })
    expect(box).toBeChecked()
  })

  it('reports the next value, not the event', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} ariaLabel="Split across categories" />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Split across categories' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('wraps the 20px box in a 44px hit area on mobile', () => {
    const { container } = render(<Checkbox checked={false} onChange={() => {}} ariaLabel="Show Net Worth" />)
    const hit = container.querySelector('span')!
    // The browser default is 13x13, well under the WCAG 2.5.8 floor of 24px.
    expect(hit.className).toMatch(/min-h-\[44px\]/)
    expect(hit.className).toMatch(/min-w-\[44px\]/)
    expect(screen.getByRole('checkbox').className).toMatch(/h-5/)
    expect(screen.getByRole('checkbox').className).toMatch(/w-5/)
  })

  it('does not fire when disabled', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} ariaLabel="Sync automatically" disabled />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
