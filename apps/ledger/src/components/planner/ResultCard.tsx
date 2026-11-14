import React from 'react'

interface ResultCardProps {
  label: string
  value: string
  highlight?: boolean
}

export const ResultCard: React.FC<ResultCardProps> = ({ label, value, highlight = false }) => (
  <div
    className={`rounded-lg border p-4 ${
      highlight ? 'border-accent bg-accent/10' : 'border-border bg-bg-primary/40'
    }`}
  >
    {/* break-words: "Projected FI Date" needs 71px in a 66px box at 768 and
        was painting past its own edge with overflow visible. */}
    <p className="text-[12px] uppercase tracking-wide text-text-secondary break-words">{label}</p>
    <p className={`text-[18px] sm:text-[22px] font-semibold mt-1 break-words leading-snug ${highlight ? 'text-accent' : 'text-text-primary'}`}>
      {value}
    </p>
  </div>
)
