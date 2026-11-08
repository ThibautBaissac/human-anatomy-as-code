// Runs bench.html variants in headless Chrome (system install) and prints results.
// Usage: node scripts/run-bench.mjs [baseUrl] [outJson]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3];
const variants = (process.env.VARIANTS ?? 'batched,batched&backend=webgl,meshes,meshes&backend=webgl').split(',');
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const all = [];
for (const v of variants) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (process.env.THROTTLE) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE });
  }
  const [mode, ...rest] = v.split('&');
  await page.goto(`${base}/bench.html?auto=1&mode=${mode}${rest.length ? '&' + rest.join('&') : ''}`);
  try {
    await page.waitForFunction(() => window.__bench, null, { timeout: 180000, polling: 1000 });
    const r = await page.evaluate(() => window.__bench);
    const gpu = await page.evaluate(async () => { try { const a = await navigator.gpu?.requestAdapter(); return a?.info ? `${a.info.vendor} ${a.info.architecture} ${a.info.description}` : 'n/a'; } catch { return 'n/a'; } });
    all.push({ variant: v, gpu, ...r, errors });
    console.log(JSON.stringify({ variant: v, gpu, backend: r.backend, loadMs: r.loadMs, pickMedianMs: r.pickMedianMs, pickP95Ms: r.pickP95Ms }));
    console.table(r.results);
  } catch (e) {
    console.log(v, 'FAILED', e.message, errors.slice(0, 5));
    all.push({ variant: v, failed: e.message, errors });
  }
  await page.close();
}
await browser.close();
if (out) writeFileSync(out, JSON.stringify(all, null, 2));
