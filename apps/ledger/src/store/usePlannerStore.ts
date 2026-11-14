import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'

export type PlannerInputValue = number | string | boolean
export type ToolInputs = Record<string, PlannerInputValue>

interface PlannerState {
  inputs: Record<string, ToolInputs>
  setInput: (tool: string, field: string, value: PlannerInputValue) => void
  resetTool: (tool: string) => void
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      inputs: {},
      setInput: (tool, field, value) =>
        set((state) => ({
          inputs: {
            ...state.inputs,
            [tool]: { ...state.inputs[tool], [field]: value },
          },
        })),
      resetTool: (tool) =>
        set((state) => {
          const next = { ...state.inputs }
          delete next[tool]
          return { inputs: next }
        }),
    }),
    {
      name: STORAGE_KEYS.planner,
      version: 1,
      // Existing installs wrote version 0 with this exact shape, so v0 to v1
      // is an identity migration. It exists so the next schema change has a
      // hook instead of a silent reinterpretation of whatever is on disk.
      migrate: (persisted: unknown) => persisted,
    }
  )
)

/** Saved inputs for a tool, merged over defaults. Components write via setInput. */
export function useToolInputs<T extends ToolInputs>(tool: string, defaults: T): T {
  const saved = usePlannerStore((s) => s.inputs[tool])
  return { ...defaults, ...saved } as T
}
