import { useState } from 'preact/hooks';
import { useApp } from '../context';
import type { Card, Word } from '../data/types';
import { Header, Segmented, Sheet } from '../ui/kit';
import { canSpeak, speak } from '../ui/speak';

type Filter = 'all' | 'started' | 'new' | 'mine';

function status(card: Card | undefined): string {
  if (!card) return 'Not started';
  if (card.stage === 'known') return 'Already knew';
  if (card.stage === 'learning') return 'Learning';
  return card.intervalDays >= 21 ? `Stuck · every ${card.intervalDays} d` : `Young · every ${card.intervalDays} d`;
}

/** The whole bank, searchable in French or English, with your progress on each word. */
export function Words() {
  const { repo, words, cards, toast } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(60);
  const [open, setOpen] = useState<Word | null>(null);
  const term = q.trim().toLowerCase();
  const shown = words.filter((w) => {
    if (filter === 'started' && !cards.has(w.id)) return false;
    if (filter === 'new' && cards.has(w.id)) return false;
    if (filter === 'mine' && !w.custom) return false;
    return !term || w.fr.toLowerCase().includes(term) || w.en.toLowerCase().includes(term);
  });
  // A whole-word match (chat for "cat") comes before words that only contain the letters.
  if (term) {
    const whole = new RegExp(`(^|[^a-zà-ÿ])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-zà-ÿ])`, 'i');
    const score = (w: Word) => (w.fr.toLowerCase() === term ? 0 : whole.test(w.en) || whole.test(w.fr) ? 1 : 2);
    shown.sort((a, b) => score(a) - score(b) || (a.rank ?? 0) - (b.rank ?? 0));
  }
  const card = open ? cards.get(open.id) : undefined;

  return (
    <>
      <Header title="Words" />
      <div class="page">
        <input class="input" type="search" aria-label="Search words" placeholder="Search French or English" value={q} onInput={(e) => { setQ((e.currentTarget as HTMLInputElement).value); setLimit(60); }} />
        <div style={{ marginTop: 10 }}>
          <Segmented<Filter> label="Show" value={filter} options={[{ value: 'all', label: 'All' }, { value: 'started', label: 'Started' }, { value: 'new', label: 'Not started' }, { value: 'mine', label: 'Mine' }]} onChange={(f) => { setFilter(f); setLimit(60); }} />
        </div>
        <p class="section-label">{shown.length.toLocaleString()} word{shown.length === 1 ? '' : 's'}</p>
        <ul class="list">
          {shown.slice(0, limit).map((w) => (
            <li key={w.id}><button type="button" class="row" onClick={() => setOpen(w)}>
              <span class="row-main"><span class="row-title" lang="fr">{w.fr}</span><span class="row-sub">{w.en}</span></span>
              <span class="muted small" style={{ textAlign: 'right', flex: 'none', maxWidth: 110 }}>{w.rank ? `#${w.rank.toLocaleString()}` : 'Mine'}<br />{status(cards.get(w.id))}</span>
            </button></li>
          ))}
        </ul>
        {shown.length > limit && <button type="button" class="btn block" style={{ marginTop: 12 }} onClick={() => setLimit(limit + 100)}>Show more</button>}
        {shown.length === 0 && <p class="empty">No words match.</p>}
      </div>
      <Sheet open={open !== null} title={open?.fr ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            <p style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>{open.en}</p>
            <p class="muted" style={{ marginTop: 0 }}>{[open.ipa && `/${open.ipa}/`, open.rank ? `#${open.rank.toLocaleString()} most common` : 'Your word', status(card)].filter(Boolean).join(' · ')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {canSpeak() && <button type="button" class="btn block" onClick={() => speak(open.fr)}>🔊 Hear it</button>}
              {card?.stage !== 'known' && <button type="button" class="btn block" onClick={async () => { await repo.markKnown(open.id); toast('Marked as already known'); setOpen(null); }}>I already know this word</button>}
              {card && <button type="button" class="btn block" onClick={async () => { await repo.reset(open.id); toast('Progress on this word was reset'); setOpen(null); }}>Start this word over</button>}
              {open.custom && <button type="button" class="btn danger block" onClick={async () => { await repo.removeCustom(open.id); setOpen(null); }}>Delete my word</button>}
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
