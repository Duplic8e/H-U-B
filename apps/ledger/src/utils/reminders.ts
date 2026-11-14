import { STORAGE_KEYS } from '../store/storageKeys'

export type ReminderSupport = 'unsupported' | 'denied' | 'granted' | 'default'

/** Notification support varies: installed iOS PWAs historically expose no
 *  Notification constructor at all, so this is feature-detected rather than
 *  assumed. */
export function reminderSupport(): ReminderSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  const p = Notification.permission
  return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'default'
}

const DEFAULT_LEAD_DAYS = 3

export function dueReminders(
  items: Array<{ key: string; label: string; nextDate: string }>,
  opts: { now: Date; leadDays?: number; ignoredKeys: string[] },
): Array<{ key: string; label: string }> {
  const lead = opts.leadDays ?? DEFAULT_LEAD_DAYS
  const ignored = new Set(opts.ignoredKeys)

  // Compare whole days, not instants. A nextDate of "2026-08-16" parses to UTC
  // midnight, which is already in the past by the time anyone opens the app on
  // the 16th, so an instant comparison silently skipped the due date itself.
  const dayIndex = (d: Date) => Math.floor(d.getTime() / 86_400_000)
  const today = dayIndex(opts.now)

  return items
    .filter((i) => !ignored.has(i.key))
    .filter((i) => {
      const t = new Date(i.nextDate).getTime()
      if (Number.isNaN(t)) return false
      const offset = dayIndex(new Date(t)) - today
      return offset >= 0 && offset <= lead
    })
    .map((i) => ({ key: i.key, label: i.label }))
}

const REMINDERS_ENABLED_KEY = STORAGE_KEYS.reminders
const LAST_NOTIFIED_KEY = STORAGE_KEYS.remindersLastNotified

/** Plain localStorage, not a zustand store: this is a small enabled flag plus
 *  a per-key "last notified" map, neither of which needs the persist
 *  middleware's reactivity or the backup/Drive-sync registry in
 *  storageKeys.ts. It is device-local dispatch bookkeeping, the same category
 *  as the sync keys that registry deliberately excludes. */
export function remindersEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(REMINDERS_ENABLED_KEY) === 'true'
}

export function setRemindersEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REMINDERS_ENABLED_KEY, enabled ? 'true' : 'false')
}

function readLastNotified(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LAST_NOTIFIED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeLastNotified(map: Record<string, string>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_NOTIFIED_KEY, JSON.stringify(map))
}

/** Fires a browser Notification for each due item, at most once per key per
 *  calendar day (local date), tracked in localStorage so it survives reloads.
 *  Silently does nothing when support isn't 'granted'. */
export function dispatchReminders(
  items: Array<{ key: string; label: string; nextDate: string }>,
  opts: { now?: Date; leadDays?: number; ignoredKeys: string[] },
): void {
  if (reminderSupport() !== 'granted') return
  if (!remindersEnabled()) return

  const now = opts.now ?? new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const due = dueReminders(items, { now, leadDays: opts.leadDays, ignoredKeys: opts.ignoredKeys })
  if (due.length === 0) return

  const lastNotified = readLastNotified()
  let changed = false
  for (const item of due) {
    if (lastNotified[item.key] === todayISO) continue
    new Notification('Upcoming bill', { body: item.label, tag: item.key })
    lastNotified[item.key] = todayISO
    changed = true
  }
  if (changed) writeLastNotified(lastNotified)
}
