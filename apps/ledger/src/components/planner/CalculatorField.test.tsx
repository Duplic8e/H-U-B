import { fireEvent, render, screen } from '@testing-library/react'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

describe('CalculatorField', () => {
  it('renders a labelled number input with the current value', () => {
    render(<CalculatorField label="Starting amount" value={5000} onChange={() => {}} />)
    expect(screen.getByLabelText('Starting amount')).toHaveValue('5000')
  })

  it('emits numeric values on change, and 0 for empty input on blur', () => {
    const onChange = vi.fn()
    render(<CalculatorField label="Years" value={10} onChange={onChange} />)
    const input = screen.getByLabelText('Years')
    fireEvent.change(input, { target: { value: '25' } })
    expect(onChange).toHaveBeenCalledWith(25)
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('renders suffix without wrapping', () => {
    render(<CalculatorField label="Scenario spread" suffix="± %" value={2} onChange={() => {}} />)
    const suffix = screen.getByText('± %')
    expect(suffix.className).toContain('whitespace-nowrap')
    expect(suffix.className).toContain('shrink-0')
  })
})

describe('ResultCard', () => {
  it('renders label and value', () => {
    render(<ResultCard label="Future value" value="$1,234" />)
    expect(screen.getByText('Future value')).toBeInTheDocument()
    expect(screen.getByText('$1,234')).toBeInTheDocument()
  })

  it('wraps long values and shrinks below the sm breakpoint instead of clipping', () => {
    render(<ResultCard label="Portfolio" value="$1,200,000" />)
    const value = screen.getByText('$1,200,000')
    expect(value.className).toContain('break-words')
    expect(value.className).toContain('text-[18px]')
    expect(value.className).toContain('sm:text-[22px]')
  })
})

describe('formatMoney', () => {
  it('rounds and adds separators', () => {
    expect(formatMoney(1234567.89)).toBe('$1,234,568')
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(-500.4)).toBe('-$500')
  })
})
