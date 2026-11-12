import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildQueue, countStages, parseImport, streak } from '../src/data/queue';
import { FrenchDB, createRepo, toWords } from '../src/data/repo';
import { intervalLabel, newCard, schedule } from '../src/data/srs';
import type { Card, Word } from '../src/data/types';

const t0 = new Date(2026, 10, 12, 9);
const mins = (c: Card, from: Date) => Math.round((Date.parse(c.due) - from.getTime()) / 60_000);
const days = (c: Card, from: Date) => Math.round((Date.parse(c.due) - from.getTime()) / 86_400_000);

describe('spaced repetition', () => {
  it('shows a new word twice in a sitting, then tomorrow', () => {
    let c = schedule(newCard('chat', t0), 'good', t0);
    expect([c.stage, c.step, mins(c, t0)]).toEqual(['learning', 1, 10]);
    c = schedule(c, 'good', t0);
    expect([c.stage, c.intervalDays, days(c, t0)]).toEqual(['review', 1, 1]);
  });

  it('grows the gap with each Good, by the ease', () => {
    let c: Card = { ...newCard('chat', t0), stage: 'review', intervalDays: 1 };
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) { c = schedule(c, 'good', t0); gaps.push(c.intervalDays); }
    expect(gaps).toEqual([3, 8, 20, 50, 125]);
  });

  it('Easy skips ahead, Hard slows down, Again relearns and remembers the lapse', () => {
    expect(schedule(newCard('a', t0), 'easy', t0)).toMatchObject({ stage: 'review', intervalDays: 4 });
    const review: Card = { ...newCard('a', t0), stage: 'review', intervalDays: 10 };
    expect(schedule(review, 'hard', t0)).toMatchObject({ intervalDays: 12, ease: 2.35 });
    expect(schedule(review, 'easy', t0)).toMatchObject({ intervalDays: 34, ease: 2.65 });
    const lapsed = schedule(review, 'again', t0);
    expect(lapsed).toMatchObject({ stage: 'learning', lapses: 1, ease: 2.3, intervalDays: 3 });
    expect(mins(lapsed, t0)).toBe(10);
    // Relearned, it returns at the shortened interval rather than starting from one day.
    expect(schedule(schedule(lapsed, 'good', t0), 'good', t0)).toMatchObject({ stage: 'review', intervalDays: 3 });
  });

  it('never lets the ease fall below 1.3', () => {
    let c: Card = { ...newCard('a', t0), stage: 'review', intervalDays: 5, ease: 1.35 };
    c = schedule(c, 'hard', t0);
    expect(c.ease).toBe(1.3);
  });

  it('labels how long each answer postpones a card', () => {
    const c = newCard('a', t0);
    expect([intervalLabel(c, 'again', t0), intervalLabel(c, 'good', t0), intervalLabel(c, 'easy', t0)]).toEqual(['1 min', '10 min', '4 d']);
    expect(intervalLabel({ ...c, stage: 'review', intervalDays: 40 }, 'good', t0)).toBe('3.3 mo');
  });
});

const words: Word[] = [{ id: 'de', fr: 'de', en: 'of', rank: 1 }, { id: 'je', fr: 'je', en: 'I', rank: 2 }, { id: 'et', fr: 'et', en: 'and', rank: 3 }, { id: 'custom:1', fr: 'bricoler', en: 'to tinker', custom: true }];

describe('the study queue', () => {
  it('introduces your own words first, then the most common, up to the daily limit', () => {
    const q = buildQueue(words, new Map(), 3, t0);
    expect(q.fresh.map((w) => w.fr)).toEqual(['bricoler', 'de', 'je']);
    expect(q.due).toEqual([]);
  });

  it('puts due cards first, counts today toward the limit, and skips known words', () => {
    const cards = new Map<string, Card>([
      ['de', { ...newCard('de', t0), stage: 'review', intervalDays: 1, due: new Date(2026, 10, 11).toISOString(), introducedOn: '2026-11-10' }],
      ['je', { ...newCard('je', t0), due: new Date(t0.getTime() + 5 * 60_000).toISOString() }],
      ['et', { ...newCard('et', t0), stage: 'known', introducedOn: '2026-11-01' }],
    ]);
    const q = buildQueue(words, cards, 2, t0);
    expect(q.due).toEqual(['de']);
    expect(q.soon).toEqual(['je']);
    expect(q.newLeftToday).toBe(1); // "je" was introduced today
    expect(q.fresh.map((w) => w.fr)).toEqual(['bricoler']);
  });

  it('counts a streak that ends today or yesterday', () => {
    const d = (id: string) => ({ id, updatedAt: '', reviews: 5, newCards: 0, correct: 5 });
    expect(streak([d('2026-11-12'), d('2026-11-11'), d('2026-11-09')], t0)).toBe(2);
    expect(streak([d('2026-11-11'), d('2026-11-10')], t0)).toBe(2);
    expect(streak([d('2026-11-09')], t0)).toBe(0);
  });

  it('sorts cards into learning, young, mature and known', () => {
    const c = (stage: Card['stage'], intervalDays: number): Card => ({ ...newCard(String(Math.random()), t0), stage, intervalDays });
    expect(countStages([c('learning', 0), c('review', 5), c('review', 30), c('known', 0)])).toEqual({ learning: 1, young: 1, mature: 1, known: 1, started: 3 });
  });
});

describe('import', () => {
  it('reads tab, semicolon, dash and comma lists, and Anki exports', () => {
    expect(parseImport('#separator:tab\n#html:true\nle chat\tthe cat\ttag1\n<b>chien</b>\tdog')).toEqual([{ fr: 'le chat', en: 'the cat' }, { fr: 'chien', en: 'dog' }]);
    expect(parseImport('bonjour; hello\nmerci - thank you\npain, bread, loaf\n\nbonjour; hi')).toEqual([{ fr: 'bonjour', en: 'hello' }, { fr: 'merci', en: 'thank you' }, { fr: 'pain', en: 'bread, loaf' }]);
    expect(parseImport('no separator here')).toEqual([]);
  });
});

describe('the word bank', () => {
  const bank = (JSON.parse(readFileSync('public/words.json', 'utf8')) as { words: Array<[string, string, string, string, string]> }).words;
  it('is large, starts with the most common words, and has no blanks or repeats', () => {
    expect(bank.length).toBeGreaterThan(5000);
    expect(bank.slice(0, 3).map((w) => w[0])).toEqual(['de', 'je', 'est']);
    expect(bank.every((w) => w[0] && w[1])).toBe(true);
    expect(new Set(bank.map((w) => w[0].toLowerCase())).size).toBe(bank.length);
    expect(toWords(bank, [{ id: 'custom:1', updatedAt: '', fr: 'x', en: 'y' }])[0]).toMatchObject({ custom: true });
  });
});

let n = 0;
describe('saving answers and merging devices', () => {
  it('logs the day, and a second device merges without losing either side', async () => {
    let clock = t0.getTime();
    const one = createRepo(new FrenchDB(`fr-${++n}`), () => new Date(clock));
    await one.answer('de', 'good');
    await one.answer('je', 'again');
    expect((await one.listDays())[0]).toMatchObject({ id: '2026-11-12', reviews: 2, newCards: 2, correct: 1 });

    clock += 3_600_000;
    const two = createRepo(new FrenchDB(`fr-${++n}`), () => new Date(clock));
    await two.mergeAll(await one.dumpAll());
    await two.answer('de', 'good');
    await two.markKnown('et');
    await two.addCustom([{ fr: 'bricoler', en: 'to tinker' }]);
    await one.mergeAll(await two.dumpAll());
    const cards = await one.cardMap();
    expect(cards.get('de')).toMatchObject({ stage: 'review', intervalDays: 1 });
    expect(cards.get('et')?.stage).toBe('known');
    expect((await one.listCustom()).map((c) => c.fr)).toEqual(['bricoler']);
    expect((await one.listDays())[0]!.reviews).toBe(3);

    await one.reset('de');
    expect((await one.cardMap()).has('de')).toBe(false);
  });
});
