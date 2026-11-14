// Controllable window.matchMedia mock for jsdom. Tests call setMatchMedia(true|false)
// to simulate desktop (>=768px => true for '(min-width: 768px)') or mobile.
type Listener = (e: { matches: boolean }) => void

let currentMatches = true // default: desktop
const listeners = new Set<Listener>()

export function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: currentMatches,
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: Listener) => listeners.add(cb),
      removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
      // Deprecated APIs some libraries still call:
      addListener: (cb: Listener) => listeners.add(cb),
      removeListener: (cb: Listener) => listeners.delete(cb),
      dispatchEvent: () => false,
    }),
  })
}

export function setMatchMedia(matches: boolean): void {
  currentMatches = matches
  listeners.forEach((cb) => cb({ matches }))
}

export function resetMatchMedia(): void {
  currentMatches = true
  listeners.clear()
}
