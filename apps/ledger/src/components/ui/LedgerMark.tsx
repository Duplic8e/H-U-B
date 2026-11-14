import React from 'react'

/** Brand mark: an L that doubles as chart axes with a rising trend line.
 *  Draws in currentColor so it follows the active theme's accent. */
export const LedgerMark: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <path d="M14 8v23a8 8 0 0 0 8 8h18" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
    <path d="M23 27l6-8 4 3 7-10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="40" cy="12" r="3" fill="currentColor" />
  </svg>
)
