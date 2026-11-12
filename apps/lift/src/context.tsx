import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Repo } from './data/repo';
import type { Settings } from './data/types';
import type { LiftSync } from './sync/sync';

export interface AppCtx {
  repo: Repo;
  sync: LiftSync;
  settings: Settings;
  toast: (message: string) => void;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside the app');
  return ctx;
}
