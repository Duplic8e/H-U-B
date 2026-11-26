// End-to-end check of "Sync all apps" on the assembled site, against a simulated GitHub.
//   Assemble the site as for hub.mjs (every app built with BASE_PATH=/H-U-B/<id>/), serve its parent, then:
//   node tests/e2e/sync-all.mjs http://localhost:4500/H-U-B/
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');

const hub = process.argv[2] ?? 'http://localhost:4500/H-U-B/';
const shots = process.env.SHOTS_DIR;
const TOKEN = 'github_pat_FAKE_sync_all';
const APPS = ['ledger', 'torque', 'lift', 'french', 'pantry'];

const files = new Map();
let sha = 0;
const puts = [];
/** Set when the token is revoked on GitHub: every request is refused. */
let revoked = false;
async function github(route) {
  const req = route.request();
  const url = new URL(req.url());
  const cors = { 'access-control-allow-origin': '*' };
  const json = (status, body) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (revoked || req.headers()['authorization'] !== `Bearer ${TOKEN}`) return json(401, { message: 'Bad credentials' });
  const m = url.pathname.match(/^\/repos\/Duplic8e\/H-U-B-helper(?:\/(contents|commits)(?:\/(.*))?)?$/);
  if (!m) return json(404, { message: 'Not Found' });
  const [, kind, rawPath] = m;
  const path = rawPath ? decodeURIComponent(rawPath) : '';
  if (!kind) return json(200, { private: true });
  if (kind === 'commits') { const f = files.get(url.searchParams.get('path')); return json(200, f ? [{ commit: { committer: { date: f.date } } }] : []); }
  if (req.method() === 'PUT') {
    const body = JSON.parse(req.postData());
    const existing = files.get(path);
    if ((existing?.sha ?? undefined) !== body.sha) return json(409, { message: 'conflict' });
    files.set(path, { sha: `sha${++sha}`, bytes: Buffer.from(body.content, 'base64'), date: new Date().toISOString() });
    puts.push(path);
    return json(200, { content: { sha: `sha${sha}` } });
  }
  const f = files.get(path);
  if (f) {
    if ((req.headers()['accept'] ?? '').includes('raw')) return route.fulfill({ status: 200, headers: cors, body: f.bytes });
    return json(200, { sha: f.sha, content: f.bytes.toString('base64'), encoding: 'base64', size: f.bytes.length });
  }
  const kids = [...files].filter(([p]) => p.startsWith(`${path}/`)).map(([p, v]) => ({ name: p.slice(path.length + 1), path: p, sha: v.sha, type: 'file' }));
  return kids.length ? json(200, kids) : json(404, { message: 'Not Found' });
}

// Another phone already backed up two pantry items.
const pantryBackup = { app: 'pantry', version: 1, syncedAt: '2026-11-20T10:00:00Z', items: [
  { id: 'b:3017620422003', updatedAt: '2026-11-20T10:00:00Z', barcode: '3017620422003', name: 'Nutella, 400 g', quantity: 2 },
  { id: 'm:beef-ground:freezer', updatedAt: '2026-11-20T10:00:00Z', name: 'Ground beef (frozen)', quantity: 3, unit: 'packs', storage: 'freezer' },
], recipes: [], prefs: [] };
files.set('pantry/data.json', { sha: 'sha0', bytes: Buffer.from(JSON.stringify(pantryBackup)), date: '2026-11-20T10:00:00Z' });

const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: shots ? 2 : 1, serviceWorkers: 'block' });
await context.route('https://api.github.com/**', github);
await context.addInitScript((token) => localStorage.setItem('hub-cloud', JSON.stringify({ owner: 'Duplic8e', repo: 'H-U-B-helper', token })), TOKEN);
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

// A fresh phone: no app has been opened here. One tap syncs them all.
await page.goto(hub);
const button = page.getByRole('button', { name: 'Sync all apps' });
await button.click();
await page.getByText(/Syncing (Ledger|Torque|Lift|French|Pantry)…/).first().waitFor();
await page.getByText('Everything is synced').waitFor({ timeout: 120000 });
if (shots) await page.screenshot({ path: `${shots}/hub-sync-all.png` });
for (const id of APPS) {
  const status = page.locator(`[data-status="${id}"]`);
  assert.equal(await status.textContent(), 'Synced just now', `${id} synced`);
}
assert.equal(await page.locator('iframe').count(), 0, 'the hidden frames are gone');
for (const id of ['torque', 'lift', 'french']) assert.ok(files.has(`${id}/data.json`), `${id} made its first backup without being opened`);

// Pantry pulled the other phone's items into this phone without being opened.
await page.goto(`${hub}pantry/`);
await page.getByText('Ground beef (frozen)').waitFor();
await page.getByText('Nutella, 400 g').waitFor();

// A token GitHub refuses: each app says so, and the Hub names them.
revoked = true;
await page.goto(hub);
await page.getByRole('button', { name: 'Sync all apps' }).click();
await page.getByText('No app could sync').waitFor({ timeout: 400000 });
if (shots) await page.screenshot({ path: `${shots}/hub-sync-all-failed.png` });
for (const id of ['lift', 'french', 'pantry', 'ledger']) assert.equal(await page.locator(`[data-status="${id}"]`).textContent(), 'Needs attention', `${id} reports the refusal`);
assert.match(await page.locator('[data-status="pantry"]').getAttribute('title'), /token/);

await browser.close();
assert.deepEqual(errors.filter((e) => !/401|Bad credentials|refused the Hub token|GitHub refused/i.test(e)), []);
console.log(`Sync all e2e passed (${puts.length} writes)`);
