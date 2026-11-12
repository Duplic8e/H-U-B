import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { parseImport } from '../data/queue';
import { Header } from '../ui/kit';

/** Add your own words: one at a time, pasted as a list, or from a file (CSV, text, or an Anki text export). */
export function Add() {
  const { repo, toast } = useApp();
  const [fr, setFr] = useState('');
  const [en, setEn] = useState('');
  const [text, setText] = useState('');
  const pairs = parseImport(text);

  const addOne = async (e: Event) => {
    e.preventDefault();
    if (!fr.trim() || !en.trim()) return;
    await repo.addCustom([{ fr: fr.trim(), en: en.trim() }]);
    toast(`Added “${fr.trim()}”. It comes up first in your next new words.`);
    setFr(''); setEn('');
  };
  const importAll = async () => {
    const added = await repo.addCustom(pairs);
    toast(`${added} new word${added === 1 ? '' : 's'} added${pairs.length - added ? `, ${pairs.length - added} updated` : ''}`);
    setText('');
  };

  return (
    <>
      <Header title="Add words" />
      <div class="page">
        <section class="card">
          <h2>One word</h2>
          <form onSubmit={(e) => void addOne(e)}>
            <label class="field"><span>French</span><input class="input" lang="fr" autocapitalize="off" value={fr} onInput={(e) => setFr((e.currentTarget as HTMLInputElement).value)} placeholder="e.g. le bricolage" /></label>
            <label class="field"><span>English</span><input class="input" value={en} onInput={(e) => setEn((e.currentTarget as HTMLInputElement).value)} placeholder="e.g. DIY, tinkering" /></label>
            <button type="submit" class="btn primary block" disabled={!fr.trim() || !en.trim()}>Add word</button>
          </form>
        </section>
        <section class="card">
          <h2>A list or a file</h2>
          <p class="muted" style={{ marginTop: 0 }}>One word per line, French then English, separated by a tab, a semicolon, a comma or “ - ”. An Anki text export works as it is.</p>
          <label class="field"><span>Paste here</span>
            <textarea class="input" aria-label="Paste a list" value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} placeholder={'bonjour; hello\nmerci; thank you'} />
          </label>
          <label class="btn block" style={{ marginBottom: 10 }}>
            Choose a file
            <input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" class="sr-only" onChange={async (e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0];
              if (file) setText(await file.text());
              (e.currentTarget as HTMLInputElement).value = '';
            }} />
          </label>
          {text.trim() !== '' && <p role="status" style={{ margin: '0 0 10px' }}>{pairs.length ? `${pairs.length} word${pairs.length === 1 ? '' : 's'} found. First: ${pairs[0]!.fr} → ${pairs[0]!.en}` : 'No French and English pairs found yet.'}</p>}
          <button type="button" class="btn primary block" disabled={!pairs.length} onClick={() => void importAll()}>Import {pairs.length || ''} word{pairs.length === 1 ? '' : 's'}</button>
        </section>
      </div>
    </>
  );
}
