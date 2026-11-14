export class SingleFlight {
  private inflight = new Map<string, Promise<unknown>>()

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key)
    if (existing) return existing as Promise<T>
    const p = fn().finally(() => this.inflight.delete(key))
    this.inflight.set(key, p)
    return p
  }
}

const lastAllowed = new Map<string, number>()

export function minInterval(key: string, ms: number, now: number = Date.now()): boolean {
  const prev = lastAllowed.get(key)
  if (prev !== undefined && now - prev < ms) return false
  lastAllowed.set(key, now)
  return true
}

// Test-only escape hatch to reset the module-level gate.
export function __resetMinInterval(): void {
  lastAllowed.clear()
}
