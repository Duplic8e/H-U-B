import { useApp } from '../context';
import { buildQueue, countStages, streak } from '../data/queue';
import { localDate } from '../data/srs';
import { HUB_URL } from '../sync/sync';
import { BarChart } from '../ui/charts';
import { Header, Icon, useLive, useTick } from '../ui/kit';

export function Today() {
  const { repo, settings, words, cards } = useApp();
  const days = useLive(() => repo.listDays()) ?? [];
  const now = new Date(useTick(30_000));
  const q = buildQueue(words, cards, settings.newPerDay, now);
  const counts = countStages(cards.values());
  const today = days.find((d) => d.id === localDate(now));
  const total = q.due.length + q.fresh.length;
  const bankSize = words.length;
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - i));
    const id = localDate(d);
    return { key: id, value: days.find((x) => x.id === id)?.reviews ?? 0, tick: i % 3 === 1 ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined };
  });
  const seg = (n: number, color: string) => (n > 0 ? <span style={{ width: `${(n / Math.max(1, bankSize)) * 100}%`, background: color, minWidth: 3 }} /> : null);

  return (
    <>
      <Header title="French" actions={<>
        {HUB_URL && <a class="icon-btn" href={HUB_URL} aria-label="Back to Hub"><Icon name="hub" /></a>}
        <a class="icon-btn" href="#/settings" aria-label="Settings"><Icon name="gear" /></a>
      </>} />
      <div class="page">
        <section class="hero-card" aria-label="Today's study">
          <p class="eyebrow">Today</p>
          {total > 0 ? (
            <>
              <h2>{total} card{total === 1 ? '' : 's'} to study</h2>
              <p>{q.due.length} to review · {q.fresh.length} new</p>
              <a class="btn block" href="#/study">{today?.reviews ? 'Continue' : 'Start'}</a>
            </>
          ) : q.soon.length > 0 ? (
            <>
              <h2>Almost done</h2>
              <p>{q.soon.length} card{q.soon.length === 1 ? '' : 's'} you are still learning come back in a few minutes.</p>
              <a class="btn block" href="#/study">Finish them now</a>
            </>
          ) : (
            <>
              <h2>All done for today</h2>
              <p>{today?.reviews ? `${today.reviews} answers today. Come back tomorrow.` : 'Nothing is due. Come back tomorrow.'}</p>
              <a class="btn block" href="#/study?extra=1">Learn {Math.min(10, settings.newPerDay)} more new words</a>
            </>
          )}
        </section>

        <div class="tiles">
          <div class="tile"><b>{streak(days, now)}</b><span>Day streak</span></div>
          <div class="tile"><b>{counts.started}</b><span>Words started</span></div>
          <div class="tile"><b>{counts.mature}</b><span>Words that stuck</span></div>
        </div>

        <section class="card" aria-label="Vocabulary">
          <div class="card-head"><h2>Vocabulary</h2><span>{(counts.started + counts.known).toLocaleString()} of {bankSize.toLocaleString()}</span></div>
          <div class="stack-bar" aria-hidden="true">
            {seg(counts.mature, '#34c759')}{seg(counts.young, '#30b0c7')}{seg(counts.learning, '#ff9500')}{seg(counts.known, '#8e8e93')}
          </div>
          <p class="legend">
            <span><i style={{ background: '#34c759' }} />Stuck {counts.mature}</span>
            <span><i style={{ background: '#30b0c7' }} />Young {counts.young}</span>
            <span><i style={{ background: '#ff9500' }} />Learning {counts.learning}</span>
            <span><i style={{ background: '#8e8e93' }} />Already knew {counts.known}</span>
          </p>
        </section>

        <section class="card" aria-label="Answers per day">
          <div class="card-head"><h2>Answers per day</h2><span>Last 2 weeks</span></div>
          <BarChart label="Answers per day" bars={last14} />
        </section>
      </div>
    </>
  );
}
