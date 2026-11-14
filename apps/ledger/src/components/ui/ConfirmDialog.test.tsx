import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  const setup = (tone: 'accent' | 'danger' = 'accent') => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Clear data?"
        message="This cannot be undone."
        confirmLabel="Clear"
        tone={tone}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    return { onConfirm, onCancel }
  }

  it('renders title, message and both buttons', () => {
    setup()
    expect(screen.getByText('Clear data?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('fires onConfirm and onCancel from their buttons', () => {
    const { onConfirm, onCancel } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('danger tone styles the confirm button with bg-error', () => {
    setup('danger')
    expect(screen.getByRole('button', { name: 'Clear' }).className).toContain('bg-error')
  })

  it('accent tone does not use bg-error', () => {
    setup('accent')
    expect(screen.getByRole('button', { name: 'Clear' }).className).not.toContain('bg-error')
  })

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog open={false} title="T" message="M" confirmLabel="Go" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByText('T')).toBeNull()
  })
})
