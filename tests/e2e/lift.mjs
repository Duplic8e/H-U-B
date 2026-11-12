// End-to-end check of Lift inside the assembled Hub site, against a simulated GitHub.
//   Assemble the site as for hub.mjs (Lift built with BASE_PATH=/H-U-B/lift/), serve it, then:
//   node tests/e2e/lift.mjs http://localhost:4500/H-U-B/
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');

const hub = process.argv[2] ?? 'http://localhost:4500/H-U-B/';
const shots = process.env.SHOTS_DIR;
const TOKEN = 'github_pat_FAKE_lift';
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
    const existing = files.get(path);
    if ((existing?.sha ?? undefined) !== body.sha) return json(409, {});
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
  page.on('dialog', (d) => d.accept());
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
const remote = () => JSON.parse(files.get('lift/data.json').bytes.toString('utf8'));

async function logBench(page, weight, reps) {
  const card = page.getByRole('region', { name: 'Bench Press' });
  for (let i = 1; i <= 4; i++) {
    await card.getByLabel(`Set ${i} weight in lb`).fill(String(weight));
    await card.getByLabel(`Set ${i} reps`).fill(String(reps));
    await card.getByLabel(`Set ${i} reps`).press('Enter');
    await card.getByRole('button', { name: `Set ${i} done` }).click();
  }
}

// ---- first install ----
let { ctx, page } = await phone();
await page.goto(`${hub}lift/`);
await page.getByRole('button', { name: 'Get started' }).waitFor();
await page.getByRole('radio', { name: 'Pounds' }).click();
await page.getByRole('radio', { name: /Push \/ Pull \/ Legs/ }).click();
await shot(page, 'lift-1-setup');
await page.getByRole('button', { name: 'Get started' }).click();

await page.getByRole('button', { name: 'Start Push' }).waitFor();
assert(await page.getByRole('link', { name: 'Back to Hub' }).isVisible(), 'Hub button');
await shot(page, 'lift-2-today');
await page.getByRole('button', { name: 'Start Push' }).click();
await page.getByRole('region', { name: 'Bench Press' }).waitFor();
// The demo: a photo thumbnail opens the movement and its steps.
await page.getByRole('button', { name: 'How to do Bench Press' }).click();
await page.getByRole('img', { name: /Bench Press: start and end position/ }).waitFor();
assert((await page.locator('.steps li').count()) > 1, 'written steps');
await shot(page, 'lift-3a-demo');
await page.getByRole('button', { name: 'Close' }).click();
await logBench(page, 135, 8);
await page.getByRole('timer', { name: 'Rest timer' }).waitFor();
await shot(page, 'lift-3-workout');
await page.getByRole('button', { name: 'Skip' }).click();
await page.getByRole('button', { name: 'Finish' }).click();
await page.getByRole('button', { name: 'Finish and save' }).click();
await page.getByRole('heading', { name: 'Push done' }).waitFor();
assert(await page.getByText('4', { exact: true }).first().isVisible());

// ---- next week: the rotation moves to Pull; start Push again, prefilled, with a progression hint ----
await page.goto(`${hub}lift/#/today`);
await page.getByRole('button', { name: 'Start Pull' }).waitFor();
await page.getByRole('button', { name: /^Push/ }).click();
const bench = page.getByRole('region', { name: 'Bench Press' });
await bench.waitFor();
assert.equal(await bench.getByLabel('Set 1 weight in lb').inputValue(), '135', 'prefilled from last time');
const hint = bench.getByRole('button', { name: /Try 140 lb/ });
await hint.waitFor();
await hint.click();
await waitFor(async () => (await bench.getByLabel('Set 2 weight in lb').inputValue()) === '140', 'the hint to apply 140 lb');
for (let i = 1; i <= 4; i++) await bench.getByRole('button', { name: `Set ${i} done` }).click();
await page.getByRole('button', { name: 'Skip' }).click();
await page.getByRole('button', { name: 'Finish' }).click();
await page.getByRole('button', { name: 'Finish and save' }).click();
await page.getByText(/new record/).waitFor();
await shot(page, 'lift-4-summary');

// Progress chart and records
await page.getByRole('link', { name: 'Progress' }).click();
await page.getByRole('img', { name: /^Workouts per week/ }).waitFor();
await page.getByRole('img', { name: /^Volume per week/ }).waitFor();
await page.getByRole('region', { name: 'Sets per muscle' }).getByText('Chest').waitFor();
await shot(page, 'lift-4a-charts');
await page.getByRole('link', { name: /Bench Press/ }).first().click();
await page.getByRole('img', { name: /Estimated one-rep max/ }).waitFor();
await page.getByRole('radio', { name: 'Volume' }).click();
await page.getByRole('img', { name: /Session volume/ }).waitFor();
await page.getByRole('region', { name: 'Progress chart' }).scrollIntoViewIfNeeded();
await shot(page, 'lift-5-progress');

// Units convert everything already logged.
await page.goto(`${hub}lift/#/settings`);
await page.getByRole('radio', { name: 'Kilograms' }).click();
await page.goto(`${hub}lift/#/progress/ex-bench`);
await page.getByText('63.5').first().waitFor(); // 140 lb
await waitFor(() => files.has('lift/data.json') && remote().workouts.length === 2 && remote().settings[0]?.unit === 'kg', 'Lift to sync');
assert(!files.get('lift/data.json').bytes.toString().includes(TOKEN), 'token never uploaded');

// The Hub shows Lift's backup.
await page.goto(hub);
await page.getByRole('link', { name: /^Lift/ }).waitFor();
await waitFor(async () => (await page.locator('[data-status="lift"]').getAttribute('data-tone')) === 'ok', 'Lift tile backed up');
await shot(page, 'lift-6-hub');
await ctx.close();

// ---- deleted from the home screen: a fresh install restores ----
({ ctx, page } = await phone('dark'));
await page.goto(`${hub}lift/`);
await page.getByText('Last workout').waitFor({ timeout: 15000 });
assert(!(await page.getByRole('button', { name: 'Get started' }).isVisible()), 'restored instead of setting up again');
await page.getByRole('button', { name: 'Start Pull' }).waitFor();
await shot(page, 'lift-7-restored-dark');
await ctx.close();

await browser.close();
assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
console.log('lift e2e: ok');
