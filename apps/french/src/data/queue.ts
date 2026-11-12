import { localDate } from './srs';
import type { Card, DayLog, Word } from './types';

export interface Queue {
  /** Card ids due now, most overdue first. */
  due: string[];
  /** Words to introduce today, most common first. */
  fresh: Word[];
  /** Learning cards that come due within the next few minutes. */
  soon: string[];
  newLeftToday: number;
}

/** What to study now: everything due, then today's new words in frequency order. */
/** `extraNew` adds new words beyond the daily limit, for "learn more today". */
export function buildQueue(words: Word[], cards: Map<string, Card>, newPerDay: number, now: Date, extraNew = 0, lookAheadMin = 20): Queue {
  const today = localDate(now);
  const nowIso = now.toISOString();
  const ahead = new Date(now.getTime() + lookAheadMin * 60_000).toISOString();
  const known = new Set(words.map((w) => w.id));
  const active = [...cards.values()].filter((c) => !c.deletedAt && c.stage !== 'known' && known.has(c.id));
  const due = active.filter((c) => c.due <= nowIso).sort((a, b) => a.due.localeCompare(b.due)).map((c) => c.id);
  const soon = active.filter((c) => c.stage === 'learning' && c.due > nowIso && c.due <= ahead).sort((a, b) => a.due.localeCompare(b.due)).map((c) => c.id);
  const introducedToday = [...cards.values()].filter((c) => !c.deletedAt && c.stage !== 'known' && c.introducedOn === today).length;
  const newLeftToday = Math.max(0, newPerDay - introducedToday) + Math.max(0, extraNew);
  const fresh: Word[] = [];
  if (newLeftToday > 0) {
    // Your own words first, then the bank from the most common down.
    for (const w of [...words.filter((x) => x.custom), ...words.filter((x) => !x.custom)]) {
      const c = cards.get(w.id);
      if (c && !c.deletedAt) continue;
      fresh.push(w);
      if (fresh.length >= newLeftToday) break;
    }
  }
  return { due, fresh, soon, newLeftToday };
}

/** Days in a row with at least one review, ending today or yesterday. */
export function streak(days: DayLog[], now: Date): number {
  const studied = new Set(days.filter((d) => !d.deletedAt && d.reviews > 0).map((d) => d.id));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!studied.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (studied.has(localDate(cursor))) { n++; cursor.setDate(cursor.getDate() - 1); }
  return n;
}

export interface Counts { learning: number; young: number; mature: number; known: number; started: number }

/** Young: reviewed, next due within 3 weeks. Mature: 3 weeks or more, the words that have stuck. */
export function countStages(cards: Iterable<Card>): Counts {
  const out: Counts = { learning: 0, young: 0, mature: 0, known: 0, started: 0 };
  for (const c of cards) {
    if (c.deletedAt) continue;
    if (c.stage === 'known') { out.known++; continue; }
    out.started++;
    if (c.stage === 'learning') out.learning++;
    else if (c.intervalDays >= 21) out.mature++;
    else out.young++;
  }
  return out;
}

/** Splits pasted text or a file into French and English pairs. Accepts tab
 *  (Anki's text export), semicolon, " - " or comma between the two sides;
 *  lines starting with # and Anki's header lines are skipped. */
export function parseImport(text: string): Array<{ fr: string; en: string }> {
  const out: Array<{ fr: string; en: string }> = [];
  const seen = new Set<string>();
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : / [-–—] /.test(line) ? / [-–—] / : ',';
    const [a, ...rest] = line.split(sep);
    const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/^"|"$/g, '').replace(/&nbsp;/g, ' ').trim();
    const fr = strip(a ?? '');
    const en = strip(typeof sep === 'string' && sep === '\t' ? (rest[0] ?? '') : rest.join(typeof sep === 'string' ? sep : ' - '));
    if (!fr || !en || seen.has(fr.toLowerCase())) continue;
    seen.add(fr.toLowerCase());
    out.push({ fr, en });
  }
  return out;
}
