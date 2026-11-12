import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp } from '../context';
import { buildQueue } from '../data/queue';
import { intervalLabel, newCard } from '../data/srs';
import type { Grade, Word } from '../data/types';
import { Header, Icon } from '../ui/kit';
import { canSpeak, speak } from '../ui/speak';

const GRADES: ReadonlyArray<{ grade: Grade; label: string }> = [
  { grade: 'again', label: 'Again' }, { grade: 'hard', label: 'Hard' }, { grade: 'good', label: 'Good' }, { grade: 'easy', label: 'Easy' },
];
const POS: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', pron: 'pronoun', art: 'article', conj: 'conjunction', int: 'interjection', num: 'number' };

/** One card at a time: see the prompt, recall the answer, reveal it, and say how well you knew it. */
export function Study({ extra }: { extra: boolean }) {
  const { repo, settings, words, byId, cards, toast } = useApp();
  // Extra new words beyond today's limit, fixed when the session opens.
  const bonus = useMemo(() => (extra ? Math.min(10, settings.newPerDay) : 0), [extra, settings.newPerDay]);
  const [bonusUsed, setBonusUsed] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const now = new Date();
  const withinLimit = buildQueue(words, cards, settings.newPerDay, now).newLeftToday;
  const q = buildQueue(words, cards, settings.newPerDay, now, Math.max(0, bonus - bonusUsed));

  let current: Word | undefined;
  let isNew = false;
  if (q.due.length) current = byId.get(q.due[0]!);
  else if (q.fresh.length) { current = q.fresh[0]; isNew = true; }
  else if (q.soon.length) current = byId.get(q.soon[0]!);

  const frFirst = settings.direction === 'fr-en';
  useEffect(() => {
    setRevealed(false);
    if (current && frFirst && settings.autoSpeak) speak(current.fr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);
  useEffect(() => {
    if (current && revealed && !frFirst && settings.autoSpeak) speak(current.fr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const left = q.due.length + q.fresh.length + q.soon.length;
  if (!current) {
    return (
      <>
        <Header title="Done" back={{ href: '#/today', label: 'French' }} />
        <div class="page"><section class="card empty"><p style={{ fontSize: 44, margin: 0 }}>🎉</p><h2>All done</h2><p>{done ? `${done} answer${done === 1 ? '' : 's'} this session.` : 'Nothing is due right now.'}</p><a class="btn primary block" href="#/today">Back to Today</a></section></div>
      </>
    );
  }

  const card = cards.get(current.id) ?? newCard(current.id, now);
  const answer = async (grade: Grade) => {
    if (isNew && extra && withinLimit === 0) setBonusUsed((n) => n + 1);
    await repo.answer(current!.id, grade);
    setDone((n) => n + 1);
    setRevealed(false);
  };
  const meta = [POS[current.pos ?? ''] ?? '', current.gen === 'm' ? 'masculine' : current.gen === 'f' ? 'feminine' : '', current.ipa ? `/${current.ipa}/` : ''].filter(Boolean).join(' · ');
  const front = frFirst ? current.fr : current.en;
  const back = frFirst ? current.en : current.fr;

  return (
    <>
      <Header title="Study" back={{ href: '#/today', label: 'French' }} actions={canSpeak() ? <button type="button" class="icon-btn" aria-label="Hear it" onClick={() => speak(current!.fr)} disabled={!frFirst && !revealed}>🔊</button> : undefined} />
      <div class="page">
        <div class="study-bar" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={done + left} aria-valuenow={done}><div style={{ width: `${(done / Math.max(1, done + left)) * 100}%` }} /></div>
        <p class="muted small" style={{ margin: '6px 4px 0' }}>{left} left{current.rank ? ` · #${current.rank.toLocaleString()} most common` : ' · your word'}</p>
        <button type="button" class="flash" aria-label={revealed ? 'Card' : 'Show answer'} onClick={() => setRevealed(true)}>
          {isNew && <span class="pill new">New</span>}
          <span class="front" lang={frFirst ? 'fr' : 'en'}>{front}</span>
          {frFirst && meta && <span class="meta">{meta}</span>}
          {revealed ? (
            <>
              <hr />
              <span class="back" lang={frFirst ? 'en' : 'fr'}>{back}</span>
              {!frFirst && meta && <span class="meta">{meta}</span>}
            </>
          ) : <span class="hint">Say it in your head, then tap to check</span>}
        </button>
        {revealed ? (
          <div class="grades" role="group" aria-label="How well did you know it?">
            {GRADES.map(({ grade, label }) => (
              <button key={grade} type="button" class={`grade ${grade}`} onClick={() => void answer(grade)}>{label}<small>{intervalLabel(card, grade, now)}</small></button>
            ))}
          </div>
        ) : (
          <button type="button" class="btn primary block" style={{ marginTop: 12 }} onClick={() => setRevealed(true)}>Show answer</button>
        )}
        <button type="button" class="link-btn" style={{ marginTop: 12 }} onClick={async () => { await repo.markKnown(current!.id); toast(`“${current!.fr}” will not come up again`); }}>
          <Icon name="check" /> I already know this word
        </button>
      </div>
    </>
  );
}
