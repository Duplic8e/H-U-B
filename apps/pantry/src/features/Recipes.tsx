import { useState } from 'preact/hooks';
import { getGeminiKey, GeminiError, suggestRecipes, type SuggestOptions, type Suggestion } from '../ai/gemini';
import { useApp } from '../context';
import { today } from '../data/expiry';
import { fit } from '../data/recipes';
import type { Recipe } from '../data/types';
import { Header, Icon, useLive } from '../ui/kit';
import { RecipeEditor } from './RecipeEditor';
import { AppliancesSheet } from './AppliancesSheet';
import { recipeMeta, RecipeSheet, type Shown } from './RecipeSheet';

// Kept for the rest of the visit, so going to the pantry and back does not lose them.
let lastSuggestions: Suggestion[] = [];

const TOGGLES: Array<[keyof SuggestOptions, string]> = [['quick', 'Quick'], ['useExpiring', 'Use what expires first'], ['highProtein', 'High protein'], ['onlyHave', 'Only what I have']];

export function Recipes() {
  const { repo } = useApp();
  const items = useLive(() => repo.listItems()) ?? [];
  const book = useLive(() => repo.listRecipes());
  const prefs = useLive(() => repo.getPrefs());
  const appliances = prefs?.appliances ?? [];
  const [pickAppliances, setPickAppliances] = useState(false);
  const [options, setOptions] = useState<SuggestOptions>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>(lastSuggestions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [shown, setShown] = useState<Shown | null>(null);
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const hasKey = !!getGeminiKey();

  const ask = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const next = await suggestRecipes(items, today(), { ...options, appliances });
      lastSuggestions = next;
      setSuggestions(next);
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : 'Something went wrong asking Gemini. Try again.');
    } finally {
      setBusy(false);
    }
  };

  /** Appliances a saved recipe needs that the kitchen does not have. */
  const lacking = (r: Pick<Recipe, 'appliances'>) => (appliances.length ? (r.appliances ?? []).filter((a) => !appliances.includes(a)) : []);
  const ranked = (book ?? []).map((r) => ({ r, f: fit(r, items), needs: lacking(r) }))
    .sort((a, b) => a.needs.length - b.needs.length || a.f.missing.length - b.f.missing.length || a.r.title.localeCompare(b.r.title));
  const fitLine = (f: ReturnType<typeof fit>, needs: string[] = []) => (needs.length ? `Needs ${needs.join(' and ')}`
    : f.missing.length === 0 ? 'You have everything' : `Missing ${f.missing.length}: ${f.missing.slice(0, 3).map((m) => m.name).join(', ')}${f.missing.length > 3 ? '…' : ''}`);

  return (
    <>
      <Header title="Recipes" back={{ href: '#/', label: 'Pantry' }} actions={<button type="button" class="icon-btn" aria-label="Type in a recipe" onClick={() => setEditing('new')}><Icon name="plus" /></button>} />
      <div class="page">
        <section class="card">
          <h2>Ideas from your pantry</h2>
          {!hasKey ? (
            <>
              <p class="muted" style={{ marginTop: 0 }}>Gemini can suggest recipes from what you have. It needs a free key from Google, which stays on this phone.</p>
              <a class="btn primary block" href="#/settings">Set up Gemini</a>
            </>
          ) : (
            <>
              <button type="button" class="row kitchen" onClick={() => setPickAppliances(true)}>
                <span class="row-main">
                  <span class="row-title">Your appliances</span>
                  <span class="row-sub">{appliances.length ? appliances.join(', ') : 'Not set: recipes may use any appliance'}</span>
                </span>
                <span class="link-btn" style={{ minHeight: 0 }}>{appliances.length ? 'Change' : 'Set'}</span>
              </button>
              <label class="field" style={{ marginTop: 8 }}><span>What do you feel like? (optional)</span>
                <input class="input" value={options.request ?? ''} placeholder="e.g. something warm for dinner" enterkeyhint="go" onInput={(e) => setOptions({ ...options, request: e.currentTarget.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void ask(); }} />
              </label>
              <div class="chips" role="group" aria-label="Preferences">
                {TOGGLES.map(([k, label]) => (
                  <button key={k} type="button" class="chip" aria-pressed={!!options[k]} onClick={() => setOptions({ ...options, [k]: !options[k] })}>{options[k] && <Icon name="check" />}{label}</button>
                ))}
              </div>
              <button type="button" class="btn primary block" style={{ marginTop: 14 }} disabled={busy || !items.length} onClick={() => void ask()}>
                <Icon name="spark" />{busy ? 'Asking Gemini…' : suggestions.length ? 'Suggest 3 more' : 'Suggest 3 recipes'}
              </button>
              {!items.length && <p class="muted small" style={{ marginBottom: 0 }}>Add some food to the pantry first.</p>}
              {error && <p class="note" role="alert" style={{ margin: '12px 0 0' }}>{error}</p>}
            </>
          )}
        </section>

        {suggestions.length > 0 && (
          <>
            <p class="section-label">Suggestions</p>
            <ul class="list" aria-label="Suggestions">
              {suggestions.map((s, i) => {
                const f = fit(s, items);
                return (
                  <li key={`${s.title}-${i}`}>
                    <button type="button" class="row" onClick={() => setShown({ kind: 'suggestion', recipe: { ...s, source: 'gemini' } })}>
                      <span class="row-main">
                        <span class="row-title wrap">{s.title}</span>
                        <span class="row-sub">{recipeMeta(s) || s.summary}</span>
                        <span class={`row-sub ${f.missing.length ? '' : 'ok'}`}>{fitLine(f)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p class="muted small" style={{ margin: '8px 4px 0' }}>Suggested by Gemini. Calories are estimates; check anything you are allergic to.</p>
          </>
        )}

        <p class="section-label">Recipe book</p>
        {book && book.length === 0 ? (
          <p class="muted" style={{ margin: '0 4px' }}>Save a suggestion, or tap + to type in a recipe of your own.</p>
        ) : (
          <ul class="list" aria-label="Recipe book">
            {ranked.map(({ r, f, needs }) => (
              <li key={r.id}>
                <button type="button" class="row" onClick={() => setShown({ kind: 'saved', recipe: r })}>
                  <span class="row-main">
                    <span class="row-title wrap">{r.title}</span>
                    <span class={`row-sub ${f.missing.length || needs.length ? (needs.length ? 'soon' : '') : 'ok'}`}>{fitLine(f, needs)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {shown && (
        <RecipeSheet
          key={shown.kind === 'saved' ? shown.recipe.id : shown.recipe.title}
          shown={shown}
          items={items}
          onClose={() => setShown(null)}
          onEdit={shown.kind === 'saved' ? () => { setEditing(shown.recipe); setShown(null); } : undefined}
          onSaved={async (id) => { const saved = await repo.getRecipe(id); if (saved) setShown({ kind: 'saved', recipe: saved }); }}
        />
      )}
      {pickAppliances && <AppliancesSheet current={appliances} onClose={() => setPickAppliances(false)} />}
      {editing && <RecipeEditor recipe={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
