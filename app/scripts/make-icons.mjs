// Renders static/icons/icon.svg to the PNG sizes of the web manifest (run once; outputs are versioned).
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const dir = new URL('../static/icons/', import.meta.url);
const svg = readFileSync(new URL('icon.svg', dir), 'utf8');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.1]]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - 2 * pad));
  await page.setContent(`<body style="margin:0;background:#1d2026;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  await page.screenshot({ path: new URL(name, dir).pathname, omitBackground: false });
  console.log(name);
}
await browser.close();
