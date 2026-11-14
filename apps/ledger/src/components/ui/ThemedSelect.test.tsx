import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemedSelect } from './ThemedSelect'
import { menuPlacement } from './menuPlacement'
import { setMatchMedia } from '../../test-utils/matchMedia'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

describe('ThemedSelect', () => {
  it('shows the selected label and opens a listbox on click', () => {
    render(<ThemedSelect value="a" options={options} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('selects an option on click and closes', () => {
    const onChange = vi.fn()
    render(<ThemedSelect value="a" options={options} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('supports keyboard: ArrowDown moves highlight, Enter selects, Escape closes', () => {
    const onChange = vi.fn()
    render(<ThemedSelect value="a" options={options} onChange={onChange} />)
    const trigger = screen.getByRole('button', { name: /alpha/i })
    fireEvent.keyDown(trigger, { key: 'Enter' })       // open
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })   // highlight Beta
    fireEvent.keyDown(trigger, { key: 'Enter' })       // select
    expect(onChange).toHaveBeenCalledWith('b')
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens the closed listbox on ArrowUp', () => {
    render(<ThemedSelect value="a" options={options} onChange={() => {}} />)
    const trigger = screen.getByRole('button', { name: /alpha/i })
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  it('renders no overlay backdrop when open', () => {
    render(<ThemedSelect value="a" options={options} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.queryByTestId('overlay-backdrop')).toBeNull()
  })

  it('opens options in a sheet on mobile and commits a selection', () => {
    setMatchMedia(false)
    const onChange = vi.fn()
    const { getByRole, getByText, getByTestId } = render(
      <ThemedSelect value="a" onChange={onChange} options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} />
    )
    fireEvent.click(getByRole('button'))
    expect(getByTestId('sheet-panel')).toBeInTheDocument()
    fireEvent.click(getByText('Beta'))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

describe('menuPlacement', () => {
  it('opens down with full height when there is room below', () => {
    expect(menuPlacement({ top: 100, bottom: 130 }, 800)).toEqual({ openUp: false, maxHeight: 256 })
  })

  it('clamps height to remaining space below', () => {
    // 800 - 600 bottom - 16 margin = 184 available
    expect(menuPlacement({ top: 570, bottom: 600 }, 800)).toEqual({ openUp: false, maxHeight: 184 })
  })

  it('flips up when below is cramped and above has more room', () => {
    // below: 800 - 720 - 16 = 64 (< 160); above: 690 - 16 = 674 → up, clamped to 256
    expect(menuPlacement({ top: 690, bottom: 720 }, 800)).toEqual({ openUp: true, maxHeight: 256 })
  })
})
