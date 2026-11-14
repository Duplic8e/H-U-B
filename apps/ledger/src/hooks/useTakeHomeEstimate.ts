import { useMemo } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  PROVINCIAL_TAX,
  takeHomeWithDeductions,
  type Province,
  type TakeHomeWithDeductions,
} from '../utils/finance/canadaTax';

/** After-tax estimate for a compensation total: province comes from the
 *  Salary & Tax tool's saved input (default ON); RRSP/FHSA are always 0 here.
 *  The full-deduction breakdown lives in the Salary & Tax tool itself. */
export function useTakeHomeEstimate(totalComp: number): {
  takeHome: TakeHomeWithDeductions;
  province: Province;
  deductionPct: number;
} {
  const province = usePlannerStore((s) => {
    const p = s.inputs['salary-tax']?.province;
    return (typeof p === 'string' && p in PROVINCIAL_TAX ? p : 'ON') as Province;
  });

  const takeHome = useMemo(
    () => takeHomeWithDeductions(totalComp, province, 0, 0),
    [totalComp, province],
  );
  const deductionPct = takeHome.gross > 0 ? ((takeHome.gross - takeHome.net) / takeHome.gross) * 100 : 0;

  return { takeHome, province, deductionPct };
}
