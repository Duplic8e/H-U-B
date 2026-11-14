import React from 'react'
import { THEME_PREFERENCES, useThemeStore } from '../../store/useThemeStore'

/** iOS-style segmented control: System follows the device's Light/Dark
 *  setting, or pin one. */
export const AppearancePicker: React.FC = () => {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="grid grid-cols-3 gap-0.5 p-0.5 rounded-[9px] bg-[color-mix(in_srgb,var(--text-secondary)_16%,transparent)]"
    >
      {THEME_PREFERENCES.map(({ value, label }) => {
        const active = value === preference
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={`min-h-[32px] rounded-[7px] text-[13px] font-semibold text-text-primary transition-colors ${
              active ? 'bg-card-bg shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]' : ''
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
