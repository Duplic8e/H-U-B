// Renders public/icons/icon.svg to the PNG sizes iOS and the manifest need. Needs Playwright.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// CommonJS resolution, so a globally installed Playwright works via NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0], ['icon-maskable-512.png', 512, 0.12]]) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable icons need a full-bleed background with the artwork inside the safe zone.
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<body style="margin:0;background:#1f4fd8;display:grid;place-items:center;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`);
  await page.screenshot({ path: out(name), omitBackground: false });
}
await browser.close();
