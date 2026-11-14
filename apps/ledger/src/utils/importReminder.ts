import { STORAGE_KEYS } from '../store/storageKeys'
import { reminderSupport, remindersEnabled } from './reminders'

/** The monthly "import your transactions" reminder.
 *
 *  A web app cannot wake itself on the 1st, so the reminder has three parts:
 *  a banner the first time the app is opened in a new month, a notification
 *  at that same moment when notifications are on, and a repeating calendar
 *  event the user can add, which is the part that fires on the 1st by itself. */

interface ReminderState {
  /** Month (YYYY-MM) the banner was dismissed for. */
  dismissed?: string
  /** Month a notification was last shown for. */
  notified?: string
}

const KEY = STORAGE_KEYS.importReminder

function read(): ReminderState {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as ReminderState
  } catch {
    return {}
  }
}

function write(state: ReminderState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* not remembered */ }
}

export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Due from the 1st of each month until something is imported that month or
 *  the banner is dismissed. `hasData` keeps it away from a brand new install. */
export function importReminderDue(input: { now: Date; lastImportAt?: string; hasData: boolean }): boolean {
  if (!input.hasData) return false
  const month = monthOf(input.now)
  if (input.lastImportAt && input.lastImportAt.slice(0, 7) >= month) return false
  return read().dismissed !== month
}

export function dismissImportReminder(now: Date = new Date()): void {
  write({ ...read(), dismissed: monthOf(now) })
}

/** One notification per month, only when the user turned reminders on. */
export function notifyImportReminder(now: Date = new Date()): void {
  if (reminderSupport() !== 'granted' || !remindersEnabled()) return
  const month = monthOf(now)
  const state = read()
  if (state.notified === month) return
  new Notification('Time to import your transactions', { body: 'Download last month from your bank and import it into Ledger.', tag: 'ledger-import-reminder' })
  write({ ...state, notified: month })
}

/** A calendar event on the 1st of every month at 9:00, with an alert. */
export function importReminderIcs(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const start = `${first.getFullYear()}${pad(first.getMonth() + 1)}01T090000`
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ledger//Import Reminder//EN', 'BEGIN:VEVENT',
    'UID:ledger-import-reminder@ledger', `DTSTAMP:${stamp}`, `DTSTART:${start}`, 'DURATION:PT15M',
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=1', 'SUMMARY:Import transactions into Ledger',
    'DESCRIPTION:Download last month from your bank and import it into Ledger.',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Import transactions into Ledger', 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}
