import React, { useState } from 'react'

interface NumberInputProps {
  value: number
  onCommit: (value: number) => void
  /** Optional raw editing feedback, including incomplete numeric buffers. */
  onTextChange?: (text: string) => void
  id?: string
  min?: number
  max?: number
  step?: number
  /** Round the displayed value to this many decimals. Display only: typing
   *  and committing keep full precision. */
  maxDecimals?: number
  placeholder?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
  ariaLabel?: string
  'aria-invalid'?: 'true' | 'false'
  'aria-describedby'?: string
}

const NUMERIC = /^-?\d*\.?\d*$/

/** value.toFixed(maxDecimals) with trailing zeros and a bare trailing dot
 *  removed, so 100 shows as "100" rather than "100.000". */
function display(value: number, maxDecimals?: number): string {
  if (maxDecimals === undefined) return String(value)
  const fixed = value.toFixed(maxDecimals)
  if (!fixed.includes('.')) return fixed
  return fixed.replace(/0+$/, '').replace(/\.$/, '')
}

/** Numeric field without the native number-input pitfalls: may be empty while
 *  editing (no 0100), no spinner arrows, commits parsed numbers to the caller. */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onCommit,
  onTextChange,
  min,
  max,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  step: _step,
  maxDecimals,
  ariaLabel,
  ...rest
}) => {
  // null = not editing; otherwise the raw text being typed.
  const [text, setText] = useState<string | null>(null)

  const clamp = (n: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n))

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={text ?? display(value, maxDecimals)}
      onFocus={() => setText(value === 0 ? '' : display(value, maxDecimals))}
      onChange={(e) => {
        const next = e.target.value
        if (!NUMERIC.test(next)) return
        setText(next)
        onTextChange?.(next)
        const parsed = parseFloat(next)
        if (!Number.isNaN(parsed)) onCommit(clamp(parsed))
      }}
      onBlur={() => {
        // Only commit when the buffer actually changed. Focus seeds the
        // rounded string, so committing an untouched buffer would write the
        // rounded value back and defeat display-only rounding.
        if (text !== null && text !== display(value, maxDecimals)) {
          const parsed = parseFloat(text)
          onCommit(clamp(Number.isNaN(parsed) ? 0 : parsed))
        }
        setText(null)
      }}
      {...rest}
    />
  )
}
