// End-to-end check of Pantry: the camera reads a barcode, the product is looked up, saved, counted and used up.
// Chromium is given a fake camera that shows a generated EAN-13 barcode (needs ffmpeg), and Open Food Facts
// and GitHub are simulated, so nothing leaves the machine.
//   cd apps/pantry && npm run build && npx vite preview --port 4510 &
//   node tests/e2e/pantry.mjs http://localhost:4510/
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] ?? 'http://localhost:4510/';
const shots = process.env.SHOTS_DIR;
const BARCODE = '3017620422003';
const TOKEN = 'github_pat_FAKE_pantry';

// ---- a camera feed showing the barcode ----
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const inv = (s) => [...s].map((b) => (b === '1' ? '0' : '1')).join('');
function ean13(code) {
  const d = [...code].map(Number);
  const left = d.slice(1, 7).map((n, i) => (PARITY[d[0]][i] === 'L' ? L[n] : [...inv(L[n])].reverse().join(''))).join('');
  const right = d.slice(7).map((n) => inv(L[n])).join('');
  return `101${left}01010${right}101`;
}
const bars = [...ean13(BARCODE)].map((b, i) => (b === '1' ? `<rect x="${340 + i * 6}" y="210" width="6" height="300"/>` : '')).join('');
const dir = mkdtempSync(join(tmpdir(), 'pantry-e2e-'));
const setup = await chromium.launch();
const canvas = await setup.newPage({ viewport: { width: 1280, height: 720 } });
await canvas.setContent(`<body style="margin:0;background:#fff"><svg width="1280" height="720">${bars}</svg></body>`);
await canvas.screenshot({ path: join(dir, 'code.png') });
await setup.close();
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', join(dir, 'code.png'), '-t', '1', '-r', '10', '-pix_fmt', 'yuv420p', join(dir, 'code.y4m')]);

// ---- simulated services ----
let lookups = 0;
let online = true;
const cloud = { sha: null, text: null };
async function openFoodFacts(route) {
  const host = new URL(route.request().url()).host;
  if (host === 'world.openfoodfacts.org') lookups++;
  if (!online) return route.abort('internetdisconnected');
  if (host === 'api.nal.usda.gov') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ foods: [] }) });
  if (host !== 'world.openfoodfacts.org') return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ status: 0 }) });
  const code = new URL(route.request().url()).pathname.match(/product\/(\d+)\.json/)?.[1];
  if (code !== BARCODE) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code, status: 0, status_verbose: 'product not found' }) });
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code, status: 1, product: { product_name: 'Nutella', brands: 'Ferrero', quantity: '400 g' } }) });
}
async function github(route) {
  const req = route.request();
  const path = new URL(req.url()).pathname.replace(/^\/repos\/me\/data/, '');
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (req.headers()['authorization'] !== `Bearer ${TOKEN}`) return json(401, {});
  if (path === '') return json(200, { private: true });
  if (req.method() === 'PUT') {
    const body = JSON.parse(req.postData());
    if ((cloud.sha ?? undefined) !== body.sha) return json(409, {});
    cloud.text = Buffer.from(body.content, 'base64').toString('utf8');
    cloud.sha = `sha${Date.now()}`;
    return json(200, {});
  }
  if (path === '/contents/pantry') return cloud.sha ? json(200, [{ name: 'data.json', sha: cloud.sha }]) : json(404, {});
  if (path === '/contents/pantry/data.json') return cloud.sha ? route.fulfill({ status: 200, body: cloud.text }) : json(404, {});
  return json(404, {});
}

const IPHONE = `html:root { --safe-top: 59px; --safe-bottom: 34px; }`;
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${join(dir, 'code.y4m')}`] });
const errors = [];
async function install() {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: shots ? 2 : 1, permissions: ['camera'], serviceWorkers: 'block' });
  await context.route(/^https:\/\/(world\.open\w+facts\.org|api\.nal\.usda\.gov)\//, openFoodFacts);
  await context.route('https://api.github.com/**', github);
  await context.addInitScript((token) => localStorage.setItem('hub-cloud', JSON.stringify({ owner: 'me', repo: 'data', token })), TOKEN);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.addStyleTag({ content: IPHONE });
  return { context, page };
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, `pantry-${name}.png`) }); };
const row = (page, name) => page.locator('.list > li', { hasText: name });

const { context, page } = await install();
await page.getByText('Nothing in the pantry yet').waitFor();
await shot(page, '1-empty');

// Scan: the camera reads the barcode, the lookup fills the sheet in.
await page.getByRole('button', { name: 'Scan barcode' }).click();
await page.getByRole('dialog', { name: 'Scan a barcode' }).waitFor();
if (shots) { await page.waitForTimeout(250); await shot(page, '2-scanner'); }
const sheet = page.getByRole('dialog', { name: 'Add to pantry' });
await sheet.waitFor({ timeout: 15000 });
assert.equal(await sheet.getByLabel('Name').inputValue(), 'Nutella, 400 g');
assert.equal(await sheet.getByLabel('Brand (optional)').inputValue(), 'Ferrero');
await sheet.getByText(`Barcode ${BARCODE}`).waitFor();
assert.equal(await page.evaluate(() => document.querySelector('video')), null, 'the camera closes once a barcode is read');
await sheet.getByLabel('Expiry date (optional)').fill(await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }));
await shot(page, '3-confirm');
await sheet.getByRole('button', { name: 'Add to pantry' }).click();
await row(page, 'Nutella').getByText('Expires in 3 days').waitFor();
assert.equal(await row(page, 'Nutella').locator('output').textContent(), '1');

// Scanning it again counts another, with no second lookup.
await page.getByRole('button', { name: 'Scan barcode' }).click();
const another = page.getByRole('dialog', { name: 'Add another' });
await another.waitFor({ timeout: 15000 });
await another.getByRole('button', { name: 'Save, 2 in pantry' }).click();
await page.waitForFunction(() => document.querySelector('.list output')?.textContent === '2');
assert.equal(lookups, 1);

// By hand, for things without a barcode.
await page.getByRole('button', { name: 'Add by hand', exact: true }).click();
const manual = page.getByRole('dialog', { name: 'Add to pantry' });
await manual.getByLabel('Name').fill('Bananas');
await manual.getByRole('button', { name: 'One more' }).click();
await manual.getByRole('button', { name: 'Add to pantry' }).click();
await row(page, 'Bananas').waitFor();
assert.deepEqual(await page.locator('.list .row-title').allTextContents(), ['Nutella, 400 g', 'Bananas'], 'dated items come first');
await page.getByText('2 products, 4 items').waitFor();
await shot(page, '4-list');

// Search.
await page.getByLabel('Search the pantry').fill('banan');
assert.deepEqual(await page.locator('.list .row-title').allTextContents(), ['Bananas']);
await page.getByLabel('Search the pantry').fill('');

// Use up, and undo.
const minus = row(page, 'Bananas').getByRole('button', { name: 'One fewer' });
await minus.click();
await page.waitForFunction(() => [...document.querySelectorAll('.list > li')].find((li) => li.textContent.includes('Bananas'))?.querySelector('output')?.textContent === '1');
await minus.click();
await page.getByText('Used up Bananas').waitFor();
assert.equal(await row(page, 'Bananas').count(), 0);
await page.getByRole('button', { name: 'Undo' }).click();
await row(page, 'Bananas').waitFor();

// Edit: the expiry date can be cleared, and the item removed.
await page.getByRole('button', { name: 'Edit Nutella, 400 g' }).click();
const edit = page.getByRole('dialog', { name: 'Edit item' });
await edit.getByRole('button', { name: 'Clear' }).click();
await edit.getByRole('button', { name: 'Save', exact: true }).click();
await row(page, 'Nutella').getByText('Ferrero').waitFor();

// Cloud backup: saved to pantry/data.json, restored on a fresh install.
await page.goto(`${url}#/settings`);
await page.getByRole('button', { name: 'Sync now' }).click();
await page.getByText(/Backed up/).waitFor();
assert.ok(cloud.text && !cloud.text.includes(TOKEN));
assert.equal(JSON.parse(cloud.text).app, 'pantry');
await shot(page, '5-settings');
await context.close();

const again = await install();
await row(again.page, 'Nutella').waitFor();
await row(again.page, 'Bananas').waitFor();

// A used-up product is remembered, so scanning it offline still knows its name.
await again.page.getByRole('button', { name: 'Edit Nutella, 400 g' }).click();
await again.page.getByRole('button', { name: 'Remove from pantry' }).click();
await again.page.getByText('Removed Nutella, 400 g').waitFor();
online = false;
await again.page.getByRole('button', { name: 'Scan barcode' }).click();
const back = again.page.getByRole('dialog', { name: 'Add to pantry' });
await back.waitFor({ timeout: 15000 });
assert.equal(await back.getByLabel('Name').inputValue(), 'Nutella, 400 g');
assert.equal(lookups, 1);
await back.getByRole('button', { name: 'Close' }).click();
await again.context.close();

// A product nobody knows, with no connection: the barcode is kept and the name is typed.
const offline = await install();
await offline.page.evaluate(() => indexedDB.deleteDatabase('pantry'));
cloud.sha = cloud.text = null;
await offline.page.reload();
await offline.page.addStyleTag({ content: IPHONE });
await offline.page.getByRole('button', { name: 'Scan barcode' }).click();
const unknown = offline.page.getByRole('dialog', { name: 'Add to pantry' });
await unknown.waitFor({ timeout: 15000 });
await unknown.getByText(/no connection/).waitFor();
assert.equal(await unknown.getByRole('button', { name: 'Add to pantry' }).isDisabled(), true);
await shot(offline.page, '6-not-found');
await unknown.getByLabel('Name').fill('Hazelnut spread');
await unknown.getByRole('button', { name: 'Add to pantry' }).click();
await row(offline.page, 'Hazelnut spread').waitFor();
await offline.context.close();

// Camera refused: a reason and a way on.
const denied = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' });
const dp = await denied.newPage();
await dp.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
await dp.goto(url);
await dp.getByRole('button', { name: 'Scan barcode' }).click();
await dp.getByRole('alert').getByText(/not allowed to use the camera/).waitFor();
await dp.getByRole('button', { name: 'Add by hand instead' }).click();
await dp.getByRole('dialog', { name: 'Add to pantry' }).waitFor();
await denied.close();

await browser.close();
assert.deepEqual(errors, []);
console.log('Pantry e2e passed');
