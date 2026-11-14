import React from 'react'
import { NumberInput } from '../ui/NumberInput'

interface CalculatorFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
}

export const CalculatorField: React.FC<CalculatorFieldProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  step: _step,
  prefix,
  suffix,
}) => {
  const inputId = `calc-field-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={inputId} className="text-[13px] font-medium text-text-secondary block mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2 bg-bg-primary/50 border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
        {prefix && <span className="text-[13px] text-text-secondary whitespace-nowrap shrink-0">{prefix}</span>}
        <NumberInput
          id={inputId}
          className="w-full bg-transparent text-text-primary text-[15px]"
          value={value}
          min={min}
          max={max}
          onCommit={onChange}
        />
        {suffix && <span className="text-[13px] text-text-secondary whitespace-nowrap shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}
