import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { ingredientLine, parseIngredientLine } from '../data/recipes';
import type { Recipe } from '../data/types';
import { Sheet } from '../ui/kit';

/** Type in a recipe, or change a saved one. Ingredients and steps are one per line. */
export function RecipeEditor({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const { repo, toast } = useApp();
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [minutes, setMinutes] = useState(recipe?.minutes ? String(recipe.minutes) : '');
  const [servings, setServings] = useState(recipe?.servings ? String(recipe.servings) : '');
  const [ingredients, setIngredients] = useState((recipe?.ingredients ?? []).map(ingredientLine).join('\n'));
  const [steps, setSteps] = useState((recipe?.steps ?? []).join('\n'));

  const save = async (e: Event) => {
    e.preventDefault();
    if (!title.trim()) return;
    // Lines left as they were keep their link to a pantry item.
    const links = new Map((recipe?.ingredients ?? []).map((i) => [ingredientLine(i), i.itemId]));
    const n = (s: string) => { const v = Math.round(Number(s)); return Number.isFinite(v) && v > 0 ? v : undefined; };
    await repo.saveRecipe({
      id: recipe?.id, title, source: recipe?.source ?? 'mine', summary: recipe?.summary, kcalPerServing: recipe?.kcalPerServing, appliances: recipe?.appliances,
      minutes: n(minutes), servings: n(servings),
      ingredients: ingredients.split('\n').filter((l) => l.trim()).map((l) => { const i = parseIngredientLine(l); const itemId = links.get(l.trim()); return itemId ? { ...i, itemId } : i; }),
      steps: steps.split('\n'),
    });
    onClose();
    toast({ message: recipe ? 'Recipe saved' : `Added ${title.trim()} to your recipe book` });
  };

  return (
    <Sheet title={recipe ? 'Edit recipe' : 'New recipe'} onClose={onClose}>
      <form onSubmit={(e) => void save(e)}>
        <label class="field"><span>Name</span>
          <input class="input" value={title} required autocapitalize="sentences" placeholder="e.g. Tomato pasta" onInput={(e) => setTitle(e.currentTarget.value)} />
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <label class="field" style={{ flex: 1 }}><span>Minutes</span><input class="input" inputMode="numeric" value={minutes} onInput={(e) => setMinutes(e.currentTarget.value.replace(/\D/g, ''))} /></label>
          <label class="field" style={{ flex: 1 }}><span>Serves</span><input class="input" inputMode="numeric" value={servings} onInput={(e) => setServings(e.currentTarget.value.replace(/\D/g, ''))} /></label>
        </div>
        <label class="field"><span>Ingredients, one per line</span>
          <textarea class="input" rows={6} value={ingredients} placeholder={'1 can chopped tomatoes\n200 g pasta\n2 tbsp olive oil'} onInput={(e) => setIngredients(e.currentTarget.value)} />
        </label>
        <label class="field"><span>Steps, one per line</span>
          <textarea class="input" rows={6} value={steps} placeholder={'Boil the pasta.\nWarm the tomatoes with the oil.\nMix and serve.'} onInput={(e) => setSteps(e.currentTarget.value)} />
        </label>
        <div class="sheet-actions">
          <button type="submit" class="btn primary block" disabled={!title.trim()}>Save recipe</button>
        </div>
      </form>
    </Sheet>
  );
}
