import Dexie, { type Table } from 'dexie';
import { knownCard, localDate, newCard, schedule } from './srs';
import type { Card, CustomWord, DayLog, Dump, Grade, Settings, Synced, Word } from './types';
import { SETTINGS_ID } from './types';

export class FrenchDB extends Dexie {
  cards!: Table<Card, string>;
  custom!: Table<CustomWord, string>;
  days!: Table<DayLog, string>;
  settings!: Table<Settings, string>;
  /** Device-local values (sync bookkeeping). Never synced. */
  kv!: Table<{ key: string; value: unknown }, string>;

  constructor(name = 'french') {
    super(name);
    this.version(1).stores({ cards: 'id, due, stage', custom: 'id', days: 'id', settings: 'id', kv: 'key' });
  }
}

export const DEFAULT_SETTINGS: Omit<Settings, 'updatedAt'> = { id: SETTINGS_ID, newPerDay: 15, direction: 'fr-en', autoSpeak: true };
const live = <T extends Synced>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export function createRepo(db: FrenchDB, now: () => Date = () => new Date()) {
  const stamp = () => now().toISOString();
  const listeners = new Set<() => void>();
  let quiet = false;
  const changed = () => { if (!quiet) listeners.forEach((l) => l()); };

  const repo = {
    db,
    onLocalChange(l: () => void) { listeners.add(l); return () => listeners.delete(l); },

    async getSettings(): Promise<Settings> {
      return (await db.settings.get(SETTINGS_ID)) ?? { ...DEFAULT_SETTINGS, updatedAt: new Date(0).toISOString() };
    },
    async updateSettings(patch: Partial<Pick<Settings, 'newPerDay' | 'direction' | 'autoSpeak'>>) {
      await db.settings.put({ ...(await repo.getSettings()), ...patch, updatedAt: stamp() });
      changed();
    },

    async cardMap(): Promise<Map<string, Card>> {
      return new Map(live(await db.cards.toArray()).map((c) => [c.id, c]));
    },
    async listDays(): Promise<DayLog[]> { return live(await db.days.toArray()); },
    async listCustom(): Promise<CustomWord[]> { return live(await db.custom.toArray()); },

    /** Records an answer: reschedules the card and counts it in today's log. Returns the updated card. */
    async answer(wordId: string, grade: Grade): Promise<Card> {
      const at = now();
      const existing = await db.cards.get(wordId);
      const isNew = !existing || !!existing.deletedAt;
      const next = schedule(isNew ? newCard(wordId, at) : existing!, grade, at);
      const day = localDate(at);
      await db.transaction('rw', db.cards, db.days, async () => {
        await db.cards.put(next);
        const log = (await db.days.get(day)) ?? { id: day, updatedAt: '', reviews: 0, newCards: 0, correct: 0 };
        await db.days.put({ ...log, deletedAt: undefined, updatedAt: stamp(), reviews: log.reviews + 1, newCards: log.newCards + (isNew ? 1 : 0), correct: log.correct + (grade === 'again' ? 0 : 1) });
      });
      changed();
      return next;
    },
    /** "I already know this": the word never comes up. */
    async markKnown(wordId: string) {
      const existing = await db.cards.get(wordId);
      await db.cards.put(knownCard(wordId, now(), existing && !existing.deletedAt ? existing : undefined));
      changed();
    },
    /** Forgets all progress on a word, so it is new again. */
    async reset(wordId: string) {
      const existing = await db.cards.get(wordId);
      if (existing) await db.cards.put({ ...existing, deletedAt: stamp(), updatedAt: stamp() });
      changed();
    },

    /** Adds your own words. A French spelling already in your list is updated instead. Returns how many were added. */
    async addCustom(pairs: Array<{ fr: string; en: string }>): Promise<number> {
      const have = new Map((await db.custom.toArray()).map((c) => [c.fr.toLowerCase(), c]));
      const at = stamp();
      let added = 0;
      const rows: CustomWord[] = [];
      for (const { fr, en } of pairs) {
        const old = have.get(fr.toLowerCase());
        if (!old || old.deletedAt) added++;
        rows.push({ id: old?.id ?? `custom:${crypto.randomUUID()}`, fr, en, updatedAt: at, deletedAt: undefined });
      }
      await db.custom.bulkPut(rows);
      changed();
      return added;
    },
    async removeCustom(id: string) {
      const row = await db.custom.get(id);
      if (row) await db.custom.put({ ...row, deletedAt: stamp(), updatedAt: stamp() });
      changed();
    },

    async dumpAll(): Promise<Dump> {
      const [cards, custom, days, settings] = await Promise.all([db.cards.toArray(), db.custom.toArray(), db.days.toArray(), db.settings.toArray()]);
      return { cards, custom, days, settings };
    },
    /** Merges rows by id; the newer edit wins. Day logs keep the larger counts, so two devices on one day both count. */
    async mergeAll(remote: Dump) {
      quiet = true;
      try {
        await db.transaction('rw', [db.cards, db.custom, db.days, db.settings], async () => {
          const merge = async <T extends Synced>(table: Table<T, string>, rows: T[]) => {
            const local = new Map((await table.bulkGet(rows.map((r) => r.id))).filter((r): r is T => !!r).map((r) => [r.id, r]));
            const winners = rows.filter((r) => { const mine = local.get(r.id); return !mine || r.updatedAt > mine.updatedAt; });
            if (winners.length) await table.bulkPut(winners);
          };
          await merge(db.cards, remote.cards);
          await merge(db.custom, remote.custom);
          await merge(db.settings, remote.settings);
          const mine = new Map((await db.days.bulkGet(remote.days.map((d) => d.id))).filter((d): d is DayLog => !!d).map((d) => [d.id, d]));
          await db.days.bulkPut(remote.days.map((r) => {
            const l = mine.get(r.id);
            if (!l) return r;
            return { ...(r.updatedAt > l.updatedAt ? r : l), reviews: Math.max(r.reviews, l.reviews), newCards: Math.max(r.newCards, l.newCards), correct: Math.max(r.correct, l.correct) };
          }));
        });
      } finally {
        quiet = false;
      }
    },
  };
  return repo;
}

export type Repo = ReturnType<typeof createRepo>;
let shared: Repo | undefined;
export const getRepo = (): Repo => (shared ??= createRepo(new FrenchDB()));

/** The bank file plus your own words, as one list. */
export function toWords(bank: Array<[string, string, string, string, string]>, custom: CustomWord[]): Word[] {
  const mine: Word[] = custom.map((c) => ({ id: c.id, fr: c.fr, en: c.en, custom: true }));
  return [...mine, ...bank.map(([fr, en, pos, gen, ipa], i) => ({ id: fr.toLowerCase(), fr, en, pos, gen: gen as Word['gen'], ipa, rank: i + 1 }))];
}
