import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildPrompt, clearGeminiKey, describePantry, GeminiError, getGeminiKey, setGeminiKey, suggestRecipes, testGeminiKey } from '../src/ai/gemini';
import { PantryDB } from '../src/data/db';
import { createRepo } from '../src/data/repo';
import type { Item } from '../src/data/types';

const KEY = 'AIzaFAKE_test_key_1234';
const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({ id, updatedAt: '', name, quantity: 1, ...extra });
const PANTRY = [
  item('b:1', 'Chopped tomatoes, 400 g', { brand: 'Mutti', quantity: 2 }),
  item('b:2', 'Spaghetti', { expiresOn: '2026-11-21' }),
  item('b:3', 'Takis Fuego'),
  item('b:4', '', { lookup: 'pending' }),
];
const answer = (recipes: unknown, finishReason = 'STOP') => new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify({ recipes }) }] } }] }), { status: 200 });
const PASTA = { title: 'Tomato spaghetti', summary: 'Quick and cosy.', minutes: 20, servings: 2, kcalPerServing: 450,
  ingredients: [{ name: 'spaghetti', amount: '200 g', pantry: 1 }, { name: 'chopped tomatoes', amount: '1 can', pantry: 2 }, { name: 'garlic', amount: '2 cloves', pantry: 0 }, { name: 'ghost', amount: '1', pantry: 99 }],
  steps: ['1. Boil the spaghetti.', 'Warm the tomatoes.', ' '] };

beforeEach(() => { localStorage.clear(); });

describe('the Gemini key', () => {
  it('is kept on this device only, and can be removed', () => {
    expect(getGeminiKey()).toBeNull();
    setGeminiKey(`  ${KEY} `);
    expect(getGeminiKey()).toBe(KEY);
    clearGeminiKey();
    expect(getGeminiKey()).toBeNull();
  });
  it('is never part of the backup or the export', async () => {
    setGeminiKey(KEY);
    const repo = createRepo(new PantryDB('gemini-backup'));
    await repo.saveItem({ name: 'Rice', quantity: 1 });
    await repo.saveRecipe({ title: 'Rice', source: 'mine', ingredients: [{ name: 'rice', amount: '1 cup' }], steps: ['Cook.'] });
    expect(JSON.stringify(await repo.dumpAll())).not.toContain(KEY);
  });
});

describe('asking Gemini for recipes', () => {
  it('sends the key in a header (not the address), and only names, counts and dates', async () => {
    let url = '', init: RequestInit = {};
    await suggestRecipes(PANTRY, '2026-11-19', { quick: true, request: 'something warm' }, async (u, i) => { url = u; init = i!; return answer([PASTA]); }, KEY);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json', responseJsonSchema: { type: 'object', required: ['recipes'] } });
    const prompt = body.contents[0].parts[0].text as string;
    expect(prompt).toContain('1. Spaghetti x1, expires in 2 days');
    expect(prompt).toContain('2. Chopped tomatoes, 400 g (Mutti) x2');
    expect(prompt).toContain('30 minutes or less');
    expect(prompt).toContain('"something warm"');
    expect(prompt).not.toMatch(/b:1|b:2/);
  });

  it('links ingredients to pantry items and cleans the answer up', async () => {
    const [r] = await suggestRecipes(PANTRY, '2026-11-19', {}, async () => answer([PASTA, { title: 'No steps', ingredients: [{ name: 'x', amount: '', pantry: 0 }], steps: [] }]), KEY);
    expect(r).toEqual({ ...PASTA, appliances: [], ingredients: [{ name: 'spaghetti', amount: '200 g', itemId: 'b:2' }, { name: 'chopped tomatoes', amount: '1 can', itemId: 'b:1' }, { name: 'garlic', amount: '2 cloves' }, { name: 'ghost', amount: '1' }], steps: ['Boil the spaghetti.', 'Warm the tomatoes.'] });
  });

  it('switches to the newest Flash model when the default name is gone, and remembers it', async () => {
    const asked: string[] = [];
    const fake = async (u: string) => {
      asked.push(u.replace('https://generativelanguage.googleapis.com/v1beta/', ''));
      if (u.includes('gemini-flash-latest')) return new Response('{}', { status: 404 });
      if (u.includes('/models?')) return new Response(JSON.stringify({ models: [
        { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.6-flash-lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-9-flash', supportedGenerationMethods: ['embedContent'] },
      ] }));
      return answer([PASTA]);
    };
    await suggestRecipes(PANTRY, '2026-11-19', {}, fake, KEY);
    expect(asked).toEqual(['models/gemini-flash-latest:generateContent', 'models?pageSize=200', 'models/gemini-3.6-flash:generateContent']);
    asked.length = 0;
    await suggestRecipes(PANTRY, '2026-11-19', {}, fake, KEY);
    expect(asked).toEqual(['models/gemini-3.6-flash:generateContent']);
  });

  it('explains each way it can fail', async () => {
    const fail = (f: () => Promise<Response>, key: string | null = KEY) => suggestRecipes(PANTRY, '2026-11-19', {}, f, key).then(() => null, (e: GeminiError) => e.kind);
    expect(await fail(async () => answer([PASTA]), null)).toBe('no_key');
    expect(await fail(async () => new Response(JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } }), { status: 400 }))).toBe('bad_key');
    expect(await fail(async () => new Response('{}', { status: 429 }))).toBe('quota');
    expect(await fail(async () => answer([PASTA], 'SAFETY'))).toBe('blocked');
    expect(await fail(async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'OTHER' } })))).toBe('blocked');
    expect(await fail(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"recipes": [{"title": "Cut o' }] } }] })))).toBe('bad_response');
    expect(await fail(async () => answer([]))).toBe('bad_response');
    expect(await fail(() => Promise.reject(new TypeError('Failed to fetch')))).toBe('network');
  });

  it('checks a key without spending recipe quota', async () => {
    let url = '';
    await testGeminiKey(KEY, async (u) => { url = u; return new Response('{"models": []}'); });
    expect(url).toContain('/models?');
    await expect(testGeminiKey('nope', async () => new Response('{}', { status: 403 }))).rejects.toMatchObject({ kind: 'bad_key' });
  });

  it('describes the pantry soonest-expiring first, leaving out nameless items', () => {
    const { text, byNumber } = describePantry(PANTRY, '2026-11-19');
    expect(text.split('\n')).toEqual(['1. Spaghetti x1, expires in 2 days', '2. Chopped tomatoes, 400 g (Mutti) x2', '3. Takis Fuego x1']);
    expect(byNumber.get(3)?.id).toBe('b:3');
    expect(buildPrompt('', { onlyHave: true })).toContain('Use only pantry items');
  });
});

describe('appliances and units', () => {
  it('limits recipes to the kitchen\'s appliances, in the prompt and the answer schema', async () => {
    let body: { contents: Array<{ parts: Array<{ text: string }> }>; generationConfig: { responseJsonSchema: { properties: { recipes: { items: { properties: { appliances: unknown } } } } } } } | undefined;
    const kitchen = ['Air fryer', 'Microwave'];
    const result = await suggestRecipes([item('m:chicken-thigh:freezer', 'Chicken thighs (frozen)', { quantity: 6, unit: 'pieces' })], '2026-11-26', { appliances: kitchen }, async (_u, i) => {
      body = JSON.parse(String(i!.body));
      return answer([
        { ...PASTA, title: 'Air fryer thighs', appliances: ['Air fryer'] },
        { ...PASTA, title: 'Oven roast', appliances: ['Oven', 'Air fryer'] },
        { ...PASTA, title: 'No-cook salad', appliances: [] },
      ]);
    }, KEY);
    const prompt = body!.contents[0]!.parts[0]!.text;
    expect(prompt).toContain('1. Chicken thighs (frozen) x6 pieces');
    expect(prompt).toContain('only these appliances: Air fryer, Microwave');
    expect(body!.generationConfig.responseJsonSchema.properties.recipes.items.properties.appliances).toEqual({ type: 'array', description: 'Every appliance the recipe uses.', items: { type: 'string', enum: kitchen } });
    expect(result.map((r) => r.title)).toEqual(['Air fryer thighs', 'No-cook salad']);
    expect(result[0]!.appliances).toEqual(['Air fryer']);
  });
  it('leaves appliances open when none are set', async () => {
    let prompt = '';
    const [r] = await suggestRecipes(PANTRY, '2026-11-19', {}, async (_u, i) => { prompt = JSON.parse(String(i!.body)).contents[0].parts[0].text; return answer([{ ...PASTA, appliances: ['Oven'] }]); }, KEY);
    expect(prompt).not.toContain('appliances');
    expect(r!.appliances).toEqual(['Oven']);
  });
});
