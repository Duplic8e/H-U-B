/** Every persisted zustand store key, in one place.
 *
 *  Stores must reference this registry instead of inlining a string literal.
 *  backup.ts derives BACKUP_KEYS from it, so a store added here is backed up
 *  and synced automatically. This exists because ledger-portfolio-report was
 *  added in 0.7.6 and never reached the hand-maintained backup list, which
 *  quietly dropped the PortfolioAnalyst report on every restore.
 *
 *  The values are the on-disk contract with existing installs. Never edit one. */
export const STORAGE_KEYS = {
  accounts: 'accounts-storage',
  budget: 'ledger-budget',
  compensation: 'ledger-compensation',
  theme: 'financial-dashboard-theme',
  triage: 'ledger-triage',
  marketData: 'ledger-market-data',
  planner: 'ledger-planner',
  analyses: 'ledger-analyses',
  portfolio: 'ledger-portfolio',
  portfolioReport: 'ledger-portfolio-report',
  dashboardLayout: 'ledger-dashboard-layout',
  wheel: 'ledger-wheel',
  recurring: 'ledger-recurring',
  trades: 'ledger-trades',
  sync: 'ledger-sync',
  demo: 'ledger-demo-mode',
  reminders: 'ledger-reminders-enabled',
  remindersLastNotified: 'ledger-reminders-last-notified',
  autoSync: 'ledger-auto-sync',
  checklistDismissed: 'ledger-checklist-dismissed',
  toolIntroSeen: 'ledger-tool-intro-seen',
  hubSync: 'ledger-hub-sync',
  categorizeSort: 'ledger-categorize-sort',
  importReminder: 'ledger-import-reminder',
} as const

export type StorageKeyName = keyof typeof STORAGE_KEYS

/** Keys deliberately kept out of backups and Drive snapshots. Sync bookkeeping
 *  (device id, device name, revision, folder id) describes this device's
 *  relationship with Drive, so restoring it onto another device would make two
 *  machines claim the same identity. */
export const NON_BACKUP_KEY_NAMES: StorageKeyName[] = ['sync', 'demo', 'reminders', 'remindersLastNotified', 'autoSync', 'checklistDismissed', 'toolIntroSeen', 'hubSync', 'categorizeSort', 'importReminder']
