import { STORAGE_KEYS } from '../store/storageKeys'

// A plain localStorage record, not a zustand store: "I have seen this notice" is a fact
// about this device, so it must stay out of backups and Drive snapshots (the key is listed
// in NON_BACKUP_KEY_NAMES). The in-memory set keeps the notice from reappearing within a
// session when storage is blocked or full.
const memory = new Set<string>()

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.toolIntroSeen)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function hasSeenToolIntro(toolId: string): boolean {
  return memory.has(toolId) || readStored().includes(toolId)
}

export function markToolIntroSeen(toolId: string): void {
  memory.add(toolId)
  try {
    const seen = readStored()
    if (!seen.includes(toolId)) {
      localStorage.setItem(STORAGE_KEYS.toolIntroSeen, JSON.stringify([...seen, toolId]))
    }
  } catch {
    // Storage is blocked: the in-memory record above still covers this session.
  }
}

/** Test seam: forget the in-memory record. */
export function resetToolIntroMemory(): void {
  memory.clear()
}
