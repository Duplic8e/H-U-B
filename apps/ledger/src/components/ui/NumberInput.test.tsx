import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { NumberInput } from './NumberInput'

// Mirrors how every real call site uses NumberInput: controlled, echoing
// committed values back into the `value` prop.
const Controlled = (props: {
  initial: number
  onCommit?: (n: number) => void
  min?: number
  max?: number
  maxDecimals?: number
}) => {
  const [v, setV] = useState(props.initial)
  return (
    <NumberInput
      aria-label="amt"
      value={v}
      min={props.min}
      max={props.max}
      maxDecimals={props.maxDecimals}
      onCommit={(n) => {
        setV(n)
        props.onCommit?.(n)
      }}
    />
  )
}

describe('NumberInput', () => {
  it('renders the numeric value', () => {
    render(<NumberInput aria-label="amt" value={42} onCommit={() => {}} />)
    expect(screen.getByLabelText('amt')).toHaveValue('42')
  })

  it('starts empty when focusing a zero value, so typing 100 gives 100 (not 0100)', () => {
    const onCommit = vi.fn()
    render(<NumberInput aria-label="amt" value={0} onCommit={onCommit} />)
    const input = screen.getByLabelText('amt')
    fireEvent.focus(input)
    expect(input).toHaveValue('')
    fireEvent.change(input, { target: { value: '100' } })
    expect(input).toHaveValue('100')
    expect(onCommit).toHaveBeenLastCalledWith(100)
  })

  it('allows clearing while editing and commits 0 on blur', () => {
    const onCommit = vi.fn()
    render(<Controlled initial={250} onCommit={onCommit} />)
    const input = screen.getByLabelText('amt')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue('') // stays empty - no snap to 0
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenLastCalledWith(0)
    expect(input).toHaveValue('0')
  })

  it('ignores non-numeric characters', () => {
    const onCommit = vi.fn()
    render(<NumberInput aria-label="amt" value={5} onCommit={onCommit} />)
    const input = screen.getByLabelText('amt')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(input).toHaveValue('5')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('clamps to min/max on commit', () => {
    const onCommit = vi.fn()
    render(<NumberInput aria-label="pct" value={50} min={0} max={100} onCommit={onCommit} />)
    const input = screen.getByLabelText('pct')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '150' } })
    expect(onCommit).toHaveBeenLastCalledWith(100)
  })

  it('renders decimals and accepts decimal typing', () => {
    const onCommit = vi.fn()
    render(<NumberInput aria-label="amt" value={0} onCommit={onCommit} />)
    const input = screen.getByLabelText('amt')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '0.5' } })
    expect(onCommit).toHaveBeenLastCalledWith(0.5)
  })

  it('rounds the display to maxDecimals without changing the value', () => {
    render(<NumberInput aria-label="amt" value={336.82176} maxDecimals={3} onCommit={() => {}} />)
    expect(screen.getByLabelText('amt')).toHaveValue('336.822')
  })

  it('trims trailing zeros so a whole number stays whole', () => {
    render(<NumberInput aria-label="amt" value={100} maxDecimals={3} onCommit={() => {}} />)
    expect(screen.getByLabelText('amt')).toHaveValue('100')
  })

  it('seeds the edit buffer with the rounded string on focus', () => {
    render(<NumberInput aria-label="amt" value={336.82176} maxDecimals={3} onCommit={() => {}} />)
    const input = screen.getByLabelText('amt')
    fireEvent.focus(input)
    expect(input).toHaveValue('336.822')
  })

  it('commits full typed precision even when maxDecimals is set', () => {
    const onCommit = vi.fn()
    render(<NumberInput aria-label="amt" value={0} maxDecimals={3} onCommit={onCommit} />)
    const input = screen.getByLabelText('amt')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '336.82176' } })
    expect(input).toHaveValue('336.82176')
    expect(onCommit).toHaveBeenLastCalledWith(336.82176)
  })

  it('does not leak maxDecimals to the DOM', () => {
    render(<NumberInput aria-label="amt" value={5} maxDecimals={3} onCommit={() => {}} />)
    expect(screen.getByLabelText('amt')).not.toHaveAttribute('maxDecimals')
  })

  it('does not commit the rounded value when focusing and blurring without typing', () => {
    const onCommit = vi.fn()
    render(<Controlled initial={336.82176} onCommit={onCommit} maxDecimals={3} />)
    const input = screen.getByLabelText('amt')
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commits full typed precision on blur even with maxDecimals set', () => {
    const onCommit = vi.fn()
    render(<NumberInput aria-label="amt" value={0} maxDecimals={3} onCommit={onCommit} />)
    const input = screen.getByLabelText('amt')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '336.82176' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenLastCalledWith(336.82176)
  })
})
