import type { Card, Grade } from './types';

/** Spaced repetition in the style of Anki's SM-2.
 *
 *  A new word is shown twice in one sitting (1 minute, then 10 minutes apart).
 *  After that it "graduates" and comes back after 1 day, then at growing
 *  intervals: each Good multiplies the interval by the card's ease (2.5 to
 *  start). Hard grows it a little and lowers the ease, Easy grows it more and
 *  raises the ease, and Again sends the card back to relearn. */

export const LEARNING_STEPS_MIN = [1, 10];
const GRADUATE_DAYS = 1;
const EASY_GRADUATE_DAYS = 4;
const START_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 3650;

const addMinutes = (now: Date, m: number) => new Date(now.getTime() + m * 60_000).toISOString();
const addDays = (now: Date, d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newCard(id: string, now: Date): Card {
  return { id, updatedAt: now.toISOString(), stage: 'learning', step: 0, ease: START_EASE, intervalDays: 0, due: now.toISOString(), reps: 0, lapses: 0, introducedOn: localDate(now) };
}

/** The card after an answer. */
export function schedule(card: Card, grade: Grade, now: Date): Card {
  const next: Card = { ...card, reps: card.reps + 1, updatedAt: now.toISOString() };

  if (card.stage !== 'review') {
    // Learning, or relearning after a lapse.
    if (grade === 'again') return { ...next, stage: 'learning', step: 0, due: addMinutes(now, LEARNING_STEPS_MIN[0]!) };
    if (grade === 'hard') return { ...next, stage: 'learning', due: addMinutes(now, Math.max(LEARNING_STEPS_MIN[card.step] ?? 10, 6)) };
    if (grade === 'easy') {
      const days = Math.max(EASY_GRADUATE_DAYS, card.intervalDays);
      return { ...next, stage: 'review', step: 0, intervalDays: days, due: addDays(now, days) };
    }
    const step = card.step + 1;
    if (step < LEARNING_STEPS_MIN.length) return { ...next, stage: 'learning', step, due: addMinutes(now, LEARNING_STEPS_MIN[step]!) };
    // Graduated. A relearned card keeps a shortened version of its old interval.
    const days = Math.max(GRADUATE_DAYS, card.intervalDays);
    return { ...next, stage: 'review', step: 0, intervalDays: days, due: addDays(now, days) };
  }

  if (grade === 'again') {
    return { ...next, stage: 'learning', step: 0, lapses: card.lapses + 1, ease: Math.max(MIN_EASE, card.ease - 0.2), intervalDays: Math.max(1, Math.round(card.intervalDays * 0.25)), due: addMinutes(now, 10) };
  }
  let ease = card.ease;
  let days: number;
  if (grade === 'hard') { ease = Math.max(MIN_EASE, ease - 0.15); days = card.intervalDays * 1.2; }
  else if (grade === 'good') days = card.intervalDays * ease;
  else { ease += 0.15; days = card.intervalDays * ease * 1.3; }
  days = Math.min(MAX_INTERVAL_DAYS, Math.max(card.intervalDays + 1, Math.round(days)));
  return { ...next, ease, intervalDays: days, due: addDays(now, days) };
}

/** "10 min", "1 d", "2.4 mo": how long until the card returns for each answer. */
export function intervalLabel(card: Card, grade: Grade, now: Date): string {
  const ms = Date.parse(schedule(card, grade, now).due) - now.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const days = ms / 86_400_000;
  if (days < 1) return `${Math.round(min / 60)} h`;
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) return `${(days / 30).toFixed(1).replace(/\.0$/, '')} mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')} y`;
}

/** Marks a word as already known: it never comes up. */
export function knownCard(id: string, now: Date, from?: Card): Card {
  return { ...(from ?? newCard(id, now)), stage: 'known', due: '9999-12-31T00:00:00.000Z', updatedAt: now.toISOString() };
}
