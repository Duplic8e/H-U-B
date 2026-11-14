import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToolInfoButton } from './ToolInfoButton'
import { getTool } from './toolRegistry'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

describe('ToolInfoButton', () => {
  afterEach(() => {
    resetMatchMedia()
  })

  it('opens a popover with how-to and parameter glossary', () => {
    render(<ToolInfoButton tool={getTool('mortgage')!} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tool Overview' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('GDS Ratio')).toBeTruthy()
  })

  it('opens an info sheet on mobile and closes via scrim', async () => {
    setMatchMedia(false)
    const tool = getTool('mortgage')!
    const { getByLabelText, getByTestId, queryByTestId } = render(<ToolInfoButton tool={tool} />)
    fireEvent.click(getByLabelText('Tool Overview'))
    expect(getByTestId('sheet-panel')).toBeInTheDocument()
    expect(getByTestId('sheet-panel')).toHaveTextContent(tool.name)
    fireEvent.click(getByTestId('sheet-scrim'))
    await waitFor(() => expect(queryByTestId('sheet-panel')).toBeNull())
  })

  it('lists each input on a phone as a row that opens to its description', () => {
    setMatchMedia(false)
    const tool = getTool('mortgage')!
    render(<ToolInfoButton tool={tool} />)
    fireEvent.click(screen.getByLabelText('Tool Overview'))
    const panel = screen.getByTestId('sheet-panel')
    expect(panel).toHaveTextContent(tool.info.howTo)
    const param = tool.info.params[0]
    const row = screen.getByText(param.name).closest('details')!
    expect(row).not.toHaveAttribute('open')
    expect(row).toHaveTextContent(param.description)
    expect(panel).not.toHaveTextContent(`${param.name} : `)
  })

  it('gives the info button a mobile hit area', () => {
    render(<ToolInfoButton tool={getTool('mortgage')!} />)
    // Measured 24x24 in the audit, on a control that opens the only
    // explanation of what the tool does.
    const button = screen.getByRole('button', { name: 'Tool Overview' })
    expect(button.className).toMatch(/min-h-\[44px\]/)
    expect(button.className).toMatch(/min-w-\[44px\]/)
  })
})
