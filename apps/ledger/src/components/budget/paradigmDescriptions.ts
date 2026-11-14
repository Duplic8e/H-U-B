import type { BudgetingParadigm } from '../../types/budget';

export const PARADIGM_DESCRIPTIONS: Record<BudgetingParadigm, string> = {
  'Ledger Custom': 'Freeform tracking. Targets are informational; nothing is enforced.',
  'Zero-Based': 'Every dollar gets a job; cover overspending from another category.',
  'Target-Based': 'Targets are soft ceilings; overspending draws from your buffer.',
  '50/30/20': 'Spend ~50% of income on needs, 30% on wants, 20% toward savings.',
};
