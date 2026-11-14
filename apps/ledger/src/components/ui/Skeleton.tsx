import React from 'react'

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded bg-bg-primary/60 ${className}`} />
)
