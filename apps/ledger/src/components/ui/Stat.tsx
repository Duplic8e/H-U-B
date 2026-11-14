import React from 'react'

interface StatProps {
  label: string
  value: string
  tone?: 'default' | 'accent' | 'error'
  sub?: string
}

/** Standard big-number display: uppercase label, 22px value, optional subtext. */
export const Stat: React.FC<StatProps> = ({ label, value, tone = 'default', sub }) => {
  const toneClass = tone === 'accent' ? 'text-accent' : tone === 'error' ? 'text-error' : 'text-text-primary'
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[12px] uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`text-[22px] font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="text-[12px] text-text-secondary">{sub}</p>}
    </div>
  )
}
