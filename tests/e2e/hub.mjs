// End-to-end check of the assembled site against a simulated GitHub. Needs the preinstalled Playwright.
//   Build the Hub, Ledger and Torque with the workflow's BASE_PATH/VITE_HUB_URL, assemble them under <root>/H-U-B/,
//   serve <root> on a port, then:   node tests/e2e/hub.mjs http://localhost:4500/H-U-B/
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');

const hub = process.argv[2] ?? 'http://localhost:4500/H-U-B/';
const shots = process.env.SHOTS_DIR;
const TOKEN = 'github_pat_FAKE_hub_token';

// ---- a tiny GitHub: one private repo, contents API and commit listing ----
const files = new Map(); // path -> { sha, bytes, date }
let sha = 0;
async function github(route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (req.headers()['authorization'] !== `Bearer ${TOKEN}`) return json(401, { message: 'Bad credentials' });
  const m = url.pathname.match(/^\/repos\/Duplic8e\/H-U-B-helper(?:\/(contents|commits)(?:\/(.*))?)?$/);
  if (!m) return json(404, { message: 'Not Found' });
  const [, kind, rawPath] = m;
  const path = rawPath ? decodeURIComponent(rawPath) : '';
  if (!kind) return json(200, { private: true });
  if (kind === 'commits') {
    const f = files.get(url.searchParams.get('path'));
    return json(200, f ? [{ commit: { committer: { date: f.date } } }] : []);
  }
  if (req.method() === 'PUT') {
    const body = JSON.parse(req.postData());
    const existing = files.get(path);
    if (existing && existing.sha !== body.sha) return json(409, { message: 'conflict' });
    if (!existing && body.sha) return json(409, { message: 'conflict' });
    files.set(path, { sha: `sha${++sha}`, bytes: Buffer.from(body.content, 'base64'), date: new Date().toISOString() });
    return json(200, {});
  }
  const f = files.get(path);
  if (f) return route.fulfill({ status: 200, body: f.bytes, headers: { 'access-control-allow-origin': '*' } });
  const kids = [...files].filter(([p]) => p.startsWith(`${path}/`)).map(([p, v]) => ({ name: p.slice(path.length + 1), sha: v.sha }));
  return kids.length ? json(200, kids) : json(404, { message: 'Not Found' });
}

const browser = await chromium.launch();
const errors = [];
async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, colorScheme: process.env.SCHEME ?? 'light', deviceScaleFactor: shots ? 2 : 1, serviceWorkers: 'block' });
  await ctx.route('https://api.github.com/**', github);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page };
}
// iPhone 14 Pro: 59pt status bar with the Dynamic Island, 34pt home indicator. Drawn only for screenshots.
const IPHONE = `html:root { --safe-top: 59px; --safe-bottom: 34px; }
  body::after { content: ''; position: fixed; z-index: 9999; top: 11px; left: 50%; width: 126px; height: 37px; margin-left: -63px; border-radius: 20px; background: #000; pointer-events: none; }`;
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
const remote = (p) => JSON.parse(files.get(p).bytes.toString('utf8'));

// ---- first phone ----
let { ctx, page } = await phone();
await page.goto(hub);
await page.getByRole('link', { name: /^Ledger/ }).waitFor();
assert(await page.getByText('Cloud backup is off').isVisible(), 'warns that nothing is backed up');
await shot(page, '1-hub-off');

await page.getByRole('link', { name: 'Settings' }).click();
await page.getByLabel('Access token').fill('wrong');
await page.getByRole('button', { name: 'Connect' }).click();
await page.getByText(/rejected the token/).waitFor();
await page.getByLabel('Access token').fill(TOKEN);
await page.getByRole('button', { name: 'Connect' }).click();
await page.getByText(/Connected to Duplic8e\/H-U-B-helper/).waitFor();
await shot(page, '2-settings');
const saved = await page.evaluate(() => localStorage.getItem('hub-cloud'));
assert.equal(JSON.parse(saved).token, TOKEN);

// Ledger: some data, then it backs itself up.
await page.getByRole('link', { name: 'Back to Hub' }).click();
await page.getByRole('link', { name: /^Ledger/ }).click();
await page.waitForURL(/\/ledger\//);
await page.evaluate(() => {
  localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString()); // Ledger's first-run notice
  localStorage.setItem('ledger-planner', JSON.stringify({ state: { e2eMarker: 'from phone one' }, version: 0 }));
});
await page.reload();
await waitFor(() => files.has('ledger/data.json'), 'Ledger to upload');
assert.equal(remote('ledger/data.json').data['ledger-planner'].state.e2eMarker, 'from phone one');
assert(!files.get('ledger/data.json').bytes.toString().includes(TOKEN), 'token never uploaded');
const ledgerHub = page.getByRole('link', { name: 'Back to Hub' }).first();
await ledgerHub.waitFor();
await shot(page, '3-ledger');

// Torque: onboard a car, which is then backed up.
await ledgerHub.click();
await page.getByRole('link', { name: /^Torque/ }).click();
await page.waitForURL(/\/torque\//);
await page.getByRole('button', { name: 'Get started' }).click();
await page.getByRole('button', { name: 'Next' }).click();
await page.locator('input[inputmode=numeric]').fill('30000');
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('button', { name: /Skip and finish|Finish/ }).click();
await page.getByText('Up next').waitFor();
await page.getByRole('link', { name: 'Back to Hub' }).waitFor();
await shot(page, '4-torque');
// Leaving the app flushes the pending change.
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await waitFor(() => files.has('torque/data.json') && remote('torque/data.json').vehicles.length === 1, 'Torque to upload');

await page.goto(hub);
// Ledger and Torque are backed up; Lift, not opened in this test, is the one still waiting.
await page.getByText('Open Lift once').waitFor();
assert.equal(await page.locator('.app-status[data-tone="ok"]').count(), 2, 'both used tiles show a backup time');
await shot(page, '5-hub-on');
await ctx.close();

// ---- the app was deleted from the home screen: brand new storage ----
({ ctx, page } = await phone());
await page.goto(`${hub}#settings`);
await page.getByLabel('Access token').fill(TOKEN);
await page.getByRole('button', { name: 'Connect' }).click();
await page.getByText(/Connected to/).waitFor();

await page.goto(`${hub}ledger/`);
await waitFor(async () => (await page.evaluate(() => localStorage.getItem('ledger-planner')))?.includes('from phone one'), 'Ledger to restore');

await page.goto(`${hub}torque/`);
await page.getByText('Up next').waitFor({ timeout: 15000 });
assert(!(await page.getByRole('button', { name: 'Get started' }).isVisible()), 'restored instead of onboarding again');
await shot(page, '6-torque-restored');
await ctx.close();

await browser.close();
const real = errors.filter((e) => !/ResizeObserver/.test(e));
assert.deepEqual(real, [], `page errors: ${real.join(' | ')}`);
console.log('hub e2e: ok');
