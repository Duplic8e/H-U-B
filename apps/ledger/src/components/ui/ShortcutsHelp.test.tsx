import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShortcutsHelp } from './ShortcutsHelp'

describe('ShortcutsHelp', () => {
  it('lists the command palette and help shortcuts when open', () => {
    render(<ShortcutsHelp open onClose={() => {}} />)
    expect(screen.getByText('Open the command palette')).toBeInTheDocument()
    expect(screen.getByText('Show this help')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(<ShortcutsHelp open={false} onClose={() => {}} />)
    expect(screen.queryByText('Show this help')).not.toBeInTheDocument()
  })
})
