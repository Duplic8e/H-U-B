import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { nominalRaisePct, realRaisePct } from '../../utils/finance/raise'

const TOOL_ID = 'raise-inflation'
const DEFAULTS = { oldSalary: 100000, newSalary: 105000, inflationPct: 3 }

export type VerdictTone = 'raise' | 'lost' | 'wash'

export function verdictFor(real: number): { tone: VerdictTone; text: string } {
  if (real > 0.25) {
    return { tone: 'raise', text: `A real raise: your purchasing power grew ${real.toFixed(2)}%` }
  }
  if (real < -0.25) {
    return {
      tone: 'lost',
      text: `Not a real raise. Inflation ate it. You're down ${Math.abs(real).toFixed(2)}% in purchasing power.`,
    }
  }
  return { tone: 'wash', text: 'A wash: your raise roughly matches inflation.' }
}

/** State shared by the desktop and phone Raise vs Inflation layouts. */
export function useRaiseInflation() {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(TOOL_ID, field, v)

  const nominal = nominalRaisePct(inputs.oldSalary, inputs.newSalary)
  const real = realRaisePct(nominal, inputs.inflationPct)
  const realDollars = inputs.oldSalary * (real / 100)
  const { tone, text: verdict } = verdictFor(real)
  return { inputs, set, nominal, real, realDollars, tone, verdict }
}

export type RaiseInflationState = ReturnType<typeof useRaiseInflation>
