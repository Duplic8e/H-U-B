// End-to-end check of Pantry: the camera reads a barcode, the product is looked up, saved, counted and used up.
// Chromium is given a fake camera that shows a generated EAN-13 barcode (needs ffmpeg), and Open Food Facts
// and GitHub are simulated, so nothing leaves the machine.
//   cd apps/pantry && npm run build && npx vite preview --port 4510 &
//   node tests/e2e/pantry.mjs http://localhost:4510/
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
/** UPC-E, the short code on small packs: number system 0, six digits, parity set by the check digit. */
const UPCE_PARITY = ['EEEOOO', 'EEOEOO', 'EEOOEO', 'EEOOOE', 'EOEEOO', 'EOOEEO', 'EOOOEE', 'EOEOEO', 'EOEOOE', 'EOOEOE'];
function upce(code) {
  const d = [...code].map(Number);
  const body = d.slice(1, 7).map((n, i) => (UPCE_PARITY[d[7]][i] === 'O' ? L[n] : [...inv(L[n])].reverse().join(''))).join('');
  return `101${body}010101`;
}
const dir = mkdtempSync(join(tmpdir(), 'pantry-e2e-'));
async function video(name, modules) {
  const bars = [...modules].map((b, i) => (b === '1' ? `<rect x="${(1280 - modules.length * 6) / 2 + i * 6}" y="210" width="6" height="300"/>` : '')).join('');
  const setup = await chromium.launch();
  const canvas = await setup.newPage({ viewport: { width: 1280, height: 720 } });
  await canvas.setContent(`<body style="margin:0;background:#fff"><svg width="1280" height="720">${bars}</svg></body>`);
  await canvas.screenshot({ path: join(dir, `${name}.png`) });
  await setup.close();
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', join(dir, `${name}.png`), '-t', '1', '-r', '10', '-pix_fmt', 'yuv420p', join(dir, `${name}.y4m`)]);
  return join(dir, `${name}.y4m`);
}
const nutellaVideo = await video('ean13', ean13(BARCODE));
const UPCE = '04252614'; // UPC-A 042100005264
const upceVideo = await video('upce', upce(UPCE));
await video('blank', '0');
// Unpacking groceries: a jar of Nutella, taken away, a second jar, taken away, then toothpicks. Loops.
writeFileSync(join(dir, 'groceries.txt'), ['ean13', 'blank', 'ean13', 'blank', 'upce', 'blank', 'blank'].map((n, i, all) => `file '${join(dir, `${n}.png`)}'${i < all.length - 1 ? `\nduration ${n === 'blank' ? 1.8 : 1}` : ''}`).join('\n'));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'groceries.txt'), '-r', '10', '-pix_fmt', 'yuv420p', join(dir, 'groceries.y4m')]);
const groceriesVideo = join(dir, 'groceries.y4m');

// ---- a small built-in copy, made by the real build script ----
const pantryDir = new URL('../../apps/pantry/', import.meta.url).pathname;
const offTsv = ['code\tproduct_name\tquantity\tbrands\timage_small_url', '0042100005264\tFlat toothpicks\t750 pcs\tDiamond\t'].join('\n') + '\n';
writeFileSync(join(dir, 'facts.csv'), offTsv);
execFileSync('gzip', ['-f', join(dir, 'facts.csv')]);
execFileSync('node', [join(pantryDir, 'scripts/build-catalog.mjs'), '--facts', `o=${join(dir, 'facts.csv.gz')}`, '--out', join(dir, 'barcodes')], { stdio: 'pipe' });

// ---- simulated services ----
let lookups = 0;
let online = true;
/** Open Food Facts answers "temporarily unavailable" while this is set. */
let offDown = false;
const cloud = { sha: null, text: null };
async function openFoodFacts(route) {
  const host = new URL(route.request().url()).host;
  if (host === 'world.openfoodfacts.org') lookups++;
  if (!online) return route.abort('internetdisconnected');
  if (offDown && host === 'world.openfoodfacts.org') return route.fulfill({ status: 503, contentType: 'text/html', body: '<html>Page temporarily unavailable</html>' });
  if (host === 'api.nal.usda.gov') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ foods: [] }) });
  if (host !== 'world.openfoodfacts.org') return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ status: 0 }) });
  const code = new URL(route.request().url()).pathname.match(/product\/(\d+)\.json/)?.[1];
  if (code !== BARCODE) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code, status: 0, status_verbose: 'product not found' }) });
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code, status: 1, product: { product_name: 'Nutella', brands: 'Ferrero', quantity: '400 g', serving_size: '15 g', serving_quantity: 15, nutriments: { 'energy-kcal_100g': 539, fat_100g: 30.9, 'saturated-fat_100g': 10.6, carbohydrates_100g: 57.5, sugars_100g: 56.3, proteins_100g: 6.3, sodium_100g: 0.0428 } } }) });
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
const camera = (file) => chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${file}`] });
let browser = await camera(nutellaVideo);
const errors = [];
let builtInCopy = true;
async function serveCopy(route) {
  const file = join(dir, 'barcodes', new URL(route.request().url()).pathname.split('/barcodes/')[1] ?? '');
  if (!builtInCopy || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ status: 200, contentType: file.endsWith('.json') ? 'application/json' : 'application/gzip', body: readFileSync(file) });
}
async function install() {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: shots ? 2 : 1, permissions: ['camera'], serviceWorkers: 'block' });
  await context.route(/^https:\/\/(world\.open\w+facts\.org|api\.nal\.usda\.gov)\//, openFoodFacts);
  await context.route('https://api.github.com/**', github);
  await context.route('**/barcodes/**', serveCopy);
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
// Nutrition facts, per serving and per 100 g.
const facts = sheet.getByRole('region', { name: 'Nutrition facts' });
await facts.getByRole('columnheader', { name: 'Per 15 g' }).waitFor();
assert.deepEqual(await facts.getByRole('row', { name: /^Calories/ }).getByRole('cell').allTextContents(), ['Calories', '81', '539']);
assert.deepEqual(await facts.getByRole('row', { name: /^Sodium/ }).getByRole('cell').allTextContents(), ['Sodium', '6 mg', '43 mg']);
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

// A small pack's UPC-E code, while Open Food Facts is down: the built-in copy answers.
await browser.close();
browser = await camera(upceVideo);
offDown = true;
online = true;
const small = await install();
await small.page.getByRole('button', { name: 'Scan barcode' }).click();
const flat = small.page.getByRole('dialog', { name: 'Add to pantry' });
await flat.waitFor({ timeout: 15000 });
assert.equal(await flat.getByLabel('Name').inputValue(), 'Flat toothpicks, 750 pcs');
await flat.getByText('Barcode 0042100005264').waitFor();
await flat.getByRole('button', { name: 'Close' }).click();

// Down, and not in the copy: "could not be reached", with Try again, which finds it once it is back.
builtInCopy = false;
await small.page.getByRole('button', { name: 'Scan barcode' }).click();
const retry = small.page.getByRole('dialog', { name: 'Add to pantry' });
await retry.getByText(/could not be reached/).waitFor({ timeout: 15000 });
await shot(small.page, '7-try-again');
offDown = false;
builtInCopy = true;
await retry.getByRole('button', { name: 'Try again' }).click();
await small.page.waitForFunction(() => document.querySelector('[role=dialog] input')?.value === 'Flat toothpicks, 750 pcs', null, { timeout: 15000 });

// Settings shows the size of the built-in copy.
await small.page.goto(`${url}#/settings`);
await small.page.getByText(/Built-in copy: 1 products/).waitFor();
await small.context.close();

// Groceries: scan everything, then add it all at once.
await browser.close();
browser = await camera(groceriesVideo);
offDown = false;
builtInCopy = true;
const bags = await install();
const gp = bags.page;
await gp.getByRole('button', { name: 'Scan barcode' }).click();
await gp.getByRole('radio', { name: 'Groceries' }).click();
await gp.getByRole('dialog', { name: 'Scan groceries' }).waitFor();
// Two jars of Nutella and a box of toothpicks, each counted once however long it is in view.
await gp.getByRole('button', { name: 'Review 3 items' }).waitFor({ timeout: 30000 });
await shot(gp, '8-groceries-scanning');
await gp.getByRole('button', { name: 'Review 3 items' }).click();
await gp.waitForURL(/#\/groceries$/);
await gp.getByText('2 products').waitFor({ timeout: 15000 });
assert.deepEqual(await gp.locator('.list .row-title').allTextContents(), ['Nutella, 400 g', 'Flat toothpicks, 750 pcs']);
assert.deepEqual(await gp.locator('.list output').allTextContents(), ['2', '1']);
// Fix one before adding: an expiry date on the Nutella.
await gp.getByRole('button', { name: 'Edit Nutella, 400 g' }).click();
const scanned = gp.getByRole('dialog', { name: 'Scanned item' });
await scanned.getByRole('region', { name: 'Nutrition facts' }).waitFor();
await scanned.getByLabel('Expiry date (optional)').fill('2027-03-01');
await scanned.getByRole('button', { name: 'Save', exact: true }).click();
await gp.getByText(/Expires/).waitFor();
await shot(gp, '9-groceries-review');
await gp.getByRole('button', { name: 'Add 3 to pantry' }).click();
await gp.getByText('Added 3 items to the pantry').waitFor();
await row(gp, 'Nutella').locator('output', { hasText: '2' }).waitFor();
await row(gp, 'Flat toothpicks').waitFor();
assert.equal(await gp.locator('.banner').count(), 0);
await bags.context.close();

await browser.close();
assert.deepEqual(errors, []);
console.log('Pantry e2e passed');
