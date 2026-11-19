import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { findInPantry, isBasic } from '../data/recipes';
import type { Item, Recipe } from '../data/types';
import { Icon, Sheet } from '../ui/kit';

export type Shown = { kind: 'suggestion'; recipe: Omit<Recipe, 'id' | 'updatedAt'> } | { kind: 'saved'; recipe: Recipe };

function meta(r: Pick<Recipe, 'minutes' | 'servings' | 'kcalPerServing'>) {
  return [r.minutes && `${r.minutes} min`, r.servings && `serves ${r.servings}`, r.kcalPerServing && `about ${r.kcalPerServing} kcal per serving`].filter(Boolean).join(' · ');
}
export { meta as recipeMeta };

/** A recipe with each ingredient checked against the pantry. */
export function RecipeSheet({ shown, items, onClose, onEdit, onSaved }: { shown: Shown; items: Item[]; onClose: () => void; onEdit?: () => void; onSaved?: (id: string) => void }) {
  const { repo, toast } = useApp();
  const r = shown.recipe;
  const [cooking, setCooking] = useState(false);
  const uses = r.ingredients.map((ing) => ({ ing, item: findInPantry(ing, items) }));
  const fromPantry = [...new Map(uses.filter((u) => u.item).map((u) => [u.item!.id, u.item!])).values()];
  const [usedUp, setUsedUp] = useState<Set<string>>(new Set());

  const save = async () => {
    const id = await repo.saveRecipe({ ...r, source: 'gemini' });
    toast({ message: 'Saved to your recipe book' });
    onSaved?.(id);
  };
  const remove = async () => {
    if (shown.kind !== 'saved') return;
    await repo.removeRecipe(shown.recipe.id);
    onClose();
    toast({ message: `Deleted ${r.title}`, action: { label: 'Undo', run: () => void repo.restoreRecipe(shown.recipe.id) } });
  };
  const cooked = async () => {
    for (const id of usedUp) await repo.adjust(id, -1);
    onClose();
    toast({ message: usedUp.size ? `Enjoy! ${usedUp.size} used up ${usedUp.size === 1 ? 'item' : 'items'} taken out of the pantry.` : 'Enjoy!' });
  };

  return (
    <Sheet title={r.title} onClose={onClose}>
      {meta(r) && <p class="muted" style={{ margin: '0 0 6px' }}>{meta(r)}</p>}
      {r.summary && <p style={{ margin: '0 0 12px' }}>{r.summary}</p>}
      {cooking ? (
        <>
          <p class="section-label" style={{ marginTop: 8 }}>Did you use any of these up?</p>
          {fromPantry.length ? (
            <ul class="list">
              {fromPantry.map((item) => (
                <li key={item.id}>
                  <label class="row" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" class="check" checked={usedUp.has(item.id)} onChange={(e) => { const next = new Set(usedUp); if (e.currentTarget.checked) next.add(item.id); else next.delete(item.id); setUsedUp(next); }} />
                    <span class="row-main"><span class="row-title wrap">{item.name}</span><span class="row-sub">{item.quantity} in pantry → {item.quantity - (usedUp.has(item.id) ? 1 : 0)}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          ) : <p class="muted">None of the ingredients are tracked in the pantry.</p>}
          <p class="muted small">Tick only packs you finished. A jar you used a spoonful of stays.</p>
          <div class="sheet-actions">
            <button type="button" class="btn primary block" onClick={() => void cooked()}>Done</button>
            <button type="button" class="btn block" onClick={() => setCooking(false)}>Back to recipe</button>
          </div>
        </>
      ) : (
        <>
          <p class="section-label" style={{ marginTop: 8 }}>Ingredients</p>
          <ul class="ingredients">
            {uses.map(({ ing, item }, i) => {
              const state = item ? 'have' : isBasic(ing) ? 'basic' : 'missing';
              return (
                <li key={i} class={state}>
                  <span class="mark" aria-label={state === 'have' ? 'In the pantry' : state === 'basic' ? 'Kitchen basic' : 'Not in the pantry'}>{state === 'have' ? <Icon name="check" /> : state === 'basic' ? '·' : <Icon name="x" />}</span>
                  <span><b>{ing.amount}</b> {ing.name}{item && item.name.toLowerCase() !== ing.name.toLowerCase() && <span class="muted small"> ({item.name})</span>}</span>
                </li>
              );
            })}
          </ul>
          <p class="section-label">Steps</p>
          <ol class="steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <div class="sheet-actions">
            {shown.kind === 'suggestion'
              ? <button type="button" class="btn primary block" onClick={() => void save()}><Icon name="book" />Save to recipe book</button>
              : <>
                <button type="button" class="btn primary block" onClick={() => setCooking(true)}>I cooked this</button>
                {onEdit && <button type="button" class="btn block" onClick={onEdit}>Edit</button>}
                <button type="button" class="btn danger block" onClick={() => void remove()}>Delete recipe</button>
              </>}
          </div>
        </>
      )}
    </Sheet>
  );
}
