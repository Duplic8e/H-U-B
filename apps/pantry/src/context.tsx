import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Repo } from './data/repo';
import type { PantrySync } from './sync/sync';

export interface Toast { message: string; action?: { label: string; run: () => void } }

export interface AppCtx {
  repo: Repo;
  sync: PantrySync;
  toast: (toast: Toast) => void;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside the app');
  return ctx;
}
