// End-to-end check of French inside the assembled Hub site, against a simulated GitHub.
//   node tests/e2e/french.mjs http://localhost:4500/H-U-B/
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');

const hub = process.argv[2] ?? 'http://localhost:4500/H-U-B/';
const shots = process.env.SHOTS_DIR;
const TOKEN = 'github_pat_FAKE_french';
const files = new Map();
let sha = 0;
async function github(route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (req.headers()['authorization'] !== `Bearer ${TOKEN}`) return json(401, {});
  const m = url.pathname.match(/^\/repos\/Duplic8e\/H-U-B-helper(?:\/(contents|commits)(?:\/(.*))?)?$/);
  if (!m) return json(404, {});
  const [, kind, raw] = m;
  const path = raw ? decodeURIComponent(raw) : '';
  if (!kind) return json(200, { private: true });
  if (kind === 'commits') { const f = files.get(url.searchParams.get('path')); return json(200, f ? [{ commit: { committer: { date: f.date } } }] : []); }
  if (req.method() === 'PUT') {
    const body = JSON.parse(req.postData());
    if ((files.get(path)?.sha ?? undefined) !== body.sha) return json(409, {});
    files.set(path, { sha: `sha${++sha}`, bytes: Buffer.from(body.content, 'base64'), date: new Date().toISOString() });
    return json(200, {});
  }
  const f = files.get(path);
  if (f) return route.fulfill({ status: 200, body: f.bytes });
  const kids = [...files].filter(([p]) => p.startsWith(`${path}/`)).map(([p, v]) => ({ name: p.slice(path.length + 1), sha: v.sha }));
  return kids.length ? json(200, kids) : json(404, {});
}
const IPHONE = `html:root { --safe-top: 59px; --safe-bottom: 34px; }
  body::after { content: ''; position: fixed; z-index: 9999; top: 11px; left: 50%; width: 126px; height: 37px; margin-left: -63px; border-radius: 20px; background: #000; pointer-events: none; }`;
const browser = await chromium.launch();
const errors = [];
async function phone(scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: shots ? 2 : 1, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route('https://api.github.com/**', github);
  await ctx.addInitScript((t) => localStorage.setItem('hub-cloud', JSON.stringify({ owner: 'Duplic8e', repo: 'H-U-B-helper', token: t })), TOKEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page };
}
const shot = async (page, name) => {
  if (!shots) return;
  const tag = await page.addStyleTag({ content: IPHONE });
  await page.screenshot({ path: `${shots}/${name}.png` });
  await tag.evaluate((el) => el.remove());
};
const waitFor = async (cond, what, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await cond()) return; await new Promise((r) => setTimeout(r, 200)); }
  throw new Error(`timed out waiting for ${what}`);
};
const remote = () => JSON.parse(files.get('french/data.json').bytes.toString('utf8'));

let { ctx, page } = await phone();
await page.goto(`${hub}french/`);
await page.getByRole('heading', { name: '15 cards to study' }).waitFor();
assert(await page.getByText(/of 6,0\d\d/).isVisible(), 'the bank is loaded');
await shot(page, 'fr-1-today');

// The first new card is the most common word.
await page.getByRole('link', { name: 'Start' }).click();
await page.locator('.flash .front').waitFor();
assert.equal(await page.locator('.flash .front').innerText(), 'de');
await shot(page, 'fr-2-front');
await page.getByRole('button', { name: 'Show answer' }).first().click();
await page.getByText('of, from').waitFor();
const grades = page.getByRole('group', { name: 'How well did you know it?' });
assert.match(await grades.getByRole('button', { name: /Good/ }).innerText(), /10 min/);
assert.match(await grades.getByRole('button', { name: /Easy/ }).innerText(), /4 d/);
await shot(page, 'fr-3-back');
await grades.getByRole('button', { name: /Easy/ }).click();

// Next word; skip one as already known, answer a few more.
await waitFor(async () => (await page.locator('.flash .front').innerText()) === 'je', 'the next card');
await page.getByRole('button', { name: 'I already know this word' }).click();
for (let i = 0; i < 3; i++) {
  const before = await page.locator('.flash .front').innerText();
  await page.getByRole('button', { name: 'Show answer' }).first().click();
  await grades.getByRole('button', { name: /Easy/ }).click();
  await waitFor(async () => (await page.locator('.flash .front').innerText()) !== before, 'the card to change');
}

// Words: search in English, see status.
await page.goto(`${hub}french/#/words`);
await page.getByLabel('Search words').fill('cat');
await waitFor(async () => (await page.locator('.list .row-title').first().innerText()) === 'chat', 'chat to be the first result for cat');
await shot(page, 'fr-4-words');

// Add: import a small list, which then comes first.
await page.goto(`${hub}french/#/add`);
await page.getByLabel('Paste a list').fill('bricoler; to tinker\nle bricolage\tDIY');
await page.getByText(/2 words found/).waitFor();
await page.getByRole('button', { name: 'Import 2 words' }).click();
await page.getByText(/2 new words added/).waitFor();
await page.goto(`${hub}french/#/study`);
await waitFor(async () => ['bricoler', 'le bricolage'].includes(await page.locator('.flash .front').innerText()), 'my own word to come first');

// Synced to the data repo: progress and my words, never the token.
await page.goto(`${hub}french/#/today`);
await waitFor(() => files.has('french/data.json') && remote().cards.length >= 5 && remote().custom.length === 2, 'French to sync');
assert(!files.get('french/data.json').bytes.toString().includes(TOKEN));
await page.getByText('Words started').waitFor();
await shot(page, 'fr-5-progress');
await ctx.close();

// A fresh install picks the progress back up.
({ ctx, page } = await phone('dark'));
await page.goto(`${hub}french/`);
await waitFor(async () => (await page.locator('.tile b').nth(1).innerText().catch(() => '0')) === '4', 'progress to restore');
await shot(page, 'fr-6-restored-dark');
await page.goto(hub);
await waitFor(async () => (await page.locator('[data-status="french"]').getAttribute('data-tone')) === 'ok', 'French tile backed up');
await ctx.close();

await browser.close();
assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
console.log('french e2e: ok');
