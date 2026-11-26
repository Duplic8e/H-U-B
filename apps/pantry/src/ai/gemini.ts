import type { Item, RecipeIngredient } from '../data/types';

/** Recipe ideas from Google's Gemini API, called straight from the phone.
 *
 *  The key is kept only in this phone's browser storage. It is never synced, never part of a backup
 *  or export, and is sent only to Google's API, in the `x-goog-api-key` header (not in the address). */

const KEY = 'pantry-gemini-key';
const MODEL = 'pantry-gemini-model';
const API = 'https://generativelanguage.googleapis.com/v1beta';
/** Google's alias for its current Flash model, which the free tier covers. */
export const DEFAULT_MODEL = 'gemini-flash-latest';

const store = () => { try { return globalThis.localStorage; } catch { return undefined; } };
export function getGeminiKey(): string | null { try { return store()?.getItem(KEY)?.trim() || null; } catch { return null; } }
export function setGeminiKey(key: string) { try { store()?.setItem(KEY, key.trim()); store()?.removeItem(MODEL); } catch { /* private mode */ } }
export function clearGeminiKey() { try { store()?.removeItem(KEY); store()?.removeItem(MODEL); } catch { /* private mode */ } }

export class GeminiError extends Error {
  constructor(readonly kind: 'no_key' | 'bad_key' | 'quota' | 'blocked' | 'network' | 'bad_response', message: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

/** A suggestion before it is saved to the recipe book. */
export interface Suggestion {
  title: string;
  summary: string;
  minutes: number;
  servings: number;
  kcalPerServing?: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  appliances: string[];
}

export interface SuggestOptions {
  /** What the user typed: "quick dinner", "something spicy". */
  request?: string;
  quick?: boolean;
  highProtein?: boolean;
  useExpiring?: boolean;
  /** Only what is in the pantry, plus basics like salt, oil and water. */
  onlyHave?: boolean;
  /** The appliances in the kitchen; when set, every recipe uses only these. */
  appliances?: string[];
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The answer's shape. With appliances set, a recipe can only list those. */
export function schemaFor(appliances: string[] = []) {
  const recipe = SCHEMA.properties.recipes.items;
  return {
    ...SCHEMA,
    properties: { recipes: { ...SCHEMA.properties.recipes, items: { ...recipe,
      properties: { ...recipe.properties, appliances: { type: 'array', description: 'Every appliance the recipe uses.', items: appliances.length ? { type: 'string', enum: appliances } : { type: 'string' } } },
      required: [...recipe.required, 'appliances'] } } },
  };
}

const SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string', description: 'One sentence.' },
          minutes: { type: 'integer', description: 'Total time, preparation and cooking.' },
          servings: { type: 'integer' },
          kcalPerServing: { type: 'integer', description: 'Rough estimate of calories per serving.' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Plain ingredient name, e.g. "chopped tomatoes".' },
                amount: { type: 'string', description: 'e.g. "1 can", "2 tbsp", "200 g".' },
                pantry: { type: 'integer', description: 'The number of the pantry item this uses, or 0 if it is not in the pantry.' },
              },
              required: ['name', 'amount', 'pantry'],
            },
          },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'summary', 'minutes', 'servings', 'kcalPerServing', 'ingredients', 'steps'],
      },
    },
  },
  required: ['recipes'],
};

const daysLeft = (date: string, today: string) => Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);

/** The pantry as the model sees it: numbered lines, soonest-expiring first. Only names, counts and dates are sent. */
export function describePantry(items: Item[], today: string): { text: string; byNumber: Map<number, Item> } {
  const usable = items.filter((i) => i.name.trim() && i.quantity > 0)
    .sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999') || a.name.localeCompare(b.name))
    .slice(0, 200);
  const byNumber = new Map<number, Item>();
  const lines = usable.map((item, i) => {
    byNumber.set(i + 1, item);
    const left = item.expiresOn ? daysLeft(item.expiresOn, today) : undefined;
    const when = left === undefined ? '' : left < 0 ? ', past its date' : left <= 7 ? `, expires in ${left} day${left === 1 ? '' : 's'}` : '';
    return `${i + 1}. ${item.name.slice(0, 80)}${item.brand ? ` (${item.brand.slice(0, 30)})` : ''} x${item.quantity}${item.unit ? ` ${item.unit}` : ''}${when}`;
  });
  return { text: lines.join('\n'), byNumber };
}

export function buildPrompt(pantry: string, o: SuggestOptions): string {
  const wishes = [
    o.quick && 'Each recipe takes 30 minutes or less.',
    o.highProtein && 'High in protein.',
    o.useExpiring && 'Use up the items that expire soonest first.',
    o.onlyHave ? 'Use only pantry items, plus water, salt, pepper and cooking oil (mark those with pantry 0).' : 'Mostly pantry items; at most 3 ingredients that must be bought.',
    o.appliances?.length && `The kitchen has only these appliances: ${o.appliances.join(', ')}. Every recipe must be made with only these, plus hand tools (knives, pots, pans, bowls, spoons). Never use any other appliance; if something is usually baked, grilled or fried in an appliance not on the list, choose a different recipe. Items marked (frozen) need thawing time.`,
    o.request?.trim() && `The cook asked for: "${o.request.trim().slice(0, 300)}"`,
  ].filter(Boolean);
  return [
    'Suggest 3 different home recipes that use what is in this pantry.',
    'For each ingredient from the pantry, give its number in "pantry"; for anything else use 0.',
    'Write steps a home cook can follow, in order, one action per step. Amounts in metric with common kitchen measures (cups, tbsp).',
    ...wishes,
    '',
    'Pantry:',
    pantry || '(empty)',
  ].join('\n');
}

function checkSuggestion(raw: unknown, byNumber: Map<number, Item>, allowed: string[]): Suggestion | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.title !== 'string' || !r.title.trim() || !Array.isArray(r.ingredients) || !Array.isArray(r.steps)) return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined);
  const ingredients: RecipeIngredient[] = [];
  for (const x of r.ingredients as Array<Record<string, unknown>>) {
    if (!x || typeof x.name !== 'string' || !x.name.trim()) continue;
    const item = typeof x.pantry === 'number' ? byNumber.get(x.pantry) : undefined;
    ingredients.push({ name: x.name.trim(), amount: typeof x.amount === 'string' ? x.amount.trim() : '', ...(item ? { itemId: item.id } : {}) });
  }
  const steps = (r.steps as unknown[]).filter((s): s is string => typeof s === 'string' && !!s.trim()).map((s) => s.trim().replace(/^\d+[.)]\s*/, ''));
  if (!ingredients.length || !steps.length) return null;
  const appliances = Array.isArray(r.appliances) ? [...new Set((r.appliances as unknown[]).filter((a): a is string => typeof a === 'string' && !!a.trim()).map((a) => a.trim()))] : [];
  // A recipe needing an appliance the kitchen does not have is dropped.
  if (allowed.length && appliances.some((a) => !allowed.includes(a))) return null;
  return {
    appliances,
    title: r.title.trim(), summary: typeof r.summary === 'string' ? r.summary.trim() : '',
    minutes: n(r.minutes) ?? 0, servings: n(r.servings) ?? 0, kcalPerServing: n(r.kcalPerServing),
    ingredients, steps,
  };
}

async function failure(res: Response): Promise<GeminiError> {
  let detail = '';
  try { detail = JSON.stringify(await res.json()); } catch { /* not JSON */ }
  if (res.status === 429) return new GeminiError('quota', 'Gemini\'s free limit is used up for now. Try again later (the daily limit resets each day).');
  if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|API key not valid/i.test(detail)) return new GeminiError('bad_key', 'Gemini did not accept the key. Check it in Settings.');
  return new GeminiError('bad_response', `Gemini returned an error (${res.status}).`);
}

/** The current Flash model, if Google renamed the default alias. */
async function findFlashModel(key: string, doFetch: Fetch): Promise<string | null> {
  const res = await doFetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) throw await failure(res);
  const { models = [] } = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
  const flash = models
    .map((m) => ({ id: (m.name ?? '').replace(/^models\//, ''), ok: m.supportedGenerationMethods?.includes('generateContent') }))
    .filter((m) => m.ok && /^gemini-[\d.]+-flash$/.test(m.id))
    .sort((a, b) => Number(b.id.match(/[\d.]+/)?.[0] ?? 0) - Number(a.id.match(/[\d.]+/)?.[0] ?? 0));
  return flash[0]?.id ?? null;
}

/** Asks Gemini for 3 recipes from the pantry. */
export async function suggestRecipes(items: Item[], today: string, options: SuggestOptions = {}, doFetch: Fetch = (i, init) => fetch(i, init), key = getGeminiKey()): Promise<Suggestion[]> {
  if (!key) throw new GeminiError('no_key', 'Add your Gemini key in Settings first.');
  const { text, byNumber } = describePantry(items, today);
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(text, options) }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schemaFor(options.appliances), maxOutputTokens: 8192 },
  });
  const call = async (model: string) => {
    try {
      return await doFetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body });
    } catch {
      throw new GeminiError('network', 'Could not reach Gemini. Check your connection.');
    }
  };
  let model = (() => { try { return store()?.getItem(MODEL) || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; } })();
  let res = await call(model);
  if (res.status === 404) {
    // The model was renamed or retired: use the newest Flash model this key can call, and remember it.
    const found = await findFlashModel(key, doFetch).catch((e) => { throw e instanceof GeminiError ? e : new GeminiError('network', 'Could not reach Gemini.'); });
    if (!found) throw new GeminiError('bad_response', 'Gemini has no Flash model available for this key.');
    model = found;
    try { store()?.setItem(MODEL, model); } catch { /* not remembered */ }
    res = await call(model);
  }
  if (!res.ok) throw await failure(res);

  const data = (await res.json().catch(() => null)) as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>; promptFeedback?: { blockReason?: string } } | null;
  const candidate = data?.candidates?.[0];
  if (data?.promptFeedback?.blockReason || (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason))) {
    throw new GeminiError('blocked', 'Gemini declined this request. Try different wording.');
  }
  const json = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? '';
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new GeminiError('bad_response', 'Gemini\'s answer was cut off or unreadable. Try again.'); }
  const recipes = ((parsed as { recipes?: unknown[] })?.recipes ?? []).map((r) => checkSuggestion(r, byNumber, options.appliances ?? [])).filter((r): r is Suggestion => !!r);
  if (!recipes.length) throw new GeminiError('bad_response', 'Gemini did not return any usable recipes. Try again.');
  return recipes;
}

/** Checks a key by listing the models it can use; no recipe quota is spent. */
export async function testGeminiKey(key: string, doFetch: Fetch = (i, init) => fetch(i, init)): Promise<void> {
  let res: Response;
  try { res = await doFetch(`${API}/models?pageSize=1`, { headers: { 'x-goog-api-key': key.trim() } }); } catch { throw new GeminiError('network', 'Could not reach Gemini. Check your connection.'); }
  if (!res.ok) throw await failure(res);
}
