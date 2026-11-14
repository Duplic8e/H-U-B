import React from 'react'
import { ThemedSelect, type ThemedSelectOption } from '../ui/ThemedSelect'

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: ThemedSelectOption[]
}

/** Dropdown twin of CalculatorField: identical label markup and control height
 *  so inputs and selects bottom-align in shared grid rows. */
export const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, options }) => {
  const selectId = `select-field-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={selectId} className="text-[13px] font-medium text-text-secondary block mb-1">
        {label}
      </label>
      <ThemedSelect id={selectId} value={value} options={options} onChange={onChange} />
    </div>
  )
}
