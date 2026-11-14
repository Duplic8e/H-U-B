import React from 'react'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
  disabled?: boolean
  /** Extra classes for the hit area, not the box. */
  className?: string
}

/** The one checkbox in the app.
 *
 *  A bare <input type="checkbox"> renders at the browser default 13x13,
 *  which is below the WCAG 2.5.8 floor of 24px and far below the 44px
 *  platform guidance. Every one of the nine call sites used the bare
 *  element. The visual box is 20px so it still reads as a checkbox, and
 *  the surrounding span carries a 44px hit area on mobile only, so
 *  desktop density is unchanged. */
export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  className = '',
}) => (
  <span
    className={`inline-flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] desktop:min-h-0 desktop:min-w-0 ${className}`}
  >
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(e) => {
        if (disabled) return
        onChange(e.target.checked)
      }}
      className="h-5 w-5 accent-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
    />
  </span>
)
