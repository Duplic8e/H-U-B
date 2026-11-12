import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Repo } from './data/repo';
import type { Card, Settings, Word } from './data/types';
import type { FrenchSync } from './sync/sync';

export interface AppCtx {
  repo: Repo;
  sync: FrenchSync;
  settings: Settings;
  /** The bank plus your own words. */
  words: Word[];
  byId: Map<string, Word>;
  cards: Map<string, Card>;
  toast: (message: string) => void;
}

export const Ctx = createContext<AppCtx | null>(null);
export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside the app');
  return ctx;
}
