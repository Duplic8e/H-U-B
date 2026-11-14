export function toDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

export function todayKey(): string {
  return toDateKey(new Date())
}
