// Canonical default widget order/ids, hoisted to module scope so it is a stable
// reference across renders (ids are what get persisted/reordered, not the elements).
// NOTE: 'net-worth' = NetWorthTrendWidget (the trend chart) and 'trend' = NetWorthWidget
// (the point-in-time figure). This naming looks swapped but is deliberate/historical -
// these ids are persisted in stored layouts, so do NOT "fix" the pairing here, it would
// orphan existing users' saved widget order.
export const DASHBOARD_WIDGET_IDS: string[] = [
  'net-worth',
  'trend',
  'monthly-summary',
  'bank',
  'investment-accounts',
  'income',
  'expense',
  'receivable',
  'other',
  'debt',
  'portfolio',
  'budget-health',
  'top-goal',
  'upcoming-vests',
];

// Human names for the Customize panel. Keyed by the same persisted ids, which
// is why 'net-worth' reads as the trend chart and 'trend' as the figure: see
// the note above about the historical pairing.
export const DASHBOARD_WIDGET_LABELS: Record<string, string> = {
  'net-worth': 'Net Worth Over Time',
  trend: 'Net Worth',
  'monthly-summary': 'Monthly Summary',
  bank: 'Bank Accounts',
  'investment-accounts': 'Investment Accounts',
  income: 'Income',
  expense: 'Expenses',
  receivable: 'Receivables',
  other: 'Others',
  debt: 'Debts and Liabilities',
  portfolio: 'Portfolio',
  'budget-health': 'Budget Health',
  'top-goal': 'Top Goal',
  'upcoming-vests': 'Upcoming Vests',
};

// Grid placement lives on the draggable wrapper div (the actual grid child), not on the
// widget's own root element, since Tailwind col-span only affects direct grid children.
export const WIDGET_SPAN: Record<string, string> = {
  'net-worth': 'md:col-span-2',
  trend: 'col-span-1 md:col-span-2 lg:col-span-1',
};
