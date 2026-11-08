// Screenshots clip.html in each capping mode / backend, headless Chrome.
// Usage: node scripts/shot-clip.mjs <baseUrl> <outDir>
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [base = 'http://localhost:5173', outDir = '../03-clipping'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const cases = (process.env.CASES ?? 'backface,stencil,none,backface&backend=webgl,stencil&backend=webgl').split(',');
for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  await page.goto(`${base}/clip.html?cap=${c}`);
  await page.waitForFunction(() => window.__clip, null, { timeout: 120000 });
  // Camera: look down at the axial cut from above-front.
  const views = { axial: [0.66, [0, -0.9, 1.4]], sagittal: [0.5, [1.5, -0.4, 0.05]] };
  let hud = '';
  for (const [axis, [t, dir]] of Object.entries(views)) {
    await page.evaluate(([axis, t, dir]) => {
      const C = window.__clip;
      for (const k of Object.keys(C.enabled)) C.enabled[k] = k === axis;
      C.setPlanePos(axis, t); C.applyPlanes();
      // hide skin (FMA7163) so internal structures show in the section
      for (const l of C.layers) l.structures.forEach((s, i) => { if (s.fma === 'FMA7163' && l.object.setVisibleAt) l.object.setVisibleAt(i, false); });
      const center = C.box.getCenter(new C.THREE.Vector3()); const size = C.box.getSize(new C.THREE.Vector3());
      if (axis === 'axial') center.z = C.THREE.MathUtils.lerp(C.box.min.z, C.box.max.z, t);
      const d = size.z * (axis === 'sagittal' ? 0.7 : 0.55);
      C.controls.target.copy(center);
      C.camera.position.set(center.x + dir[0] * d, center.y + dir[1] * d, center.z + dir[2] * d);
      C.camera.lookAt(center); C.controls.update();
    }, [axis, t, dir]);
    await page.waitForTimeout(2000);
    hud = await page.textContent('#hud');
    await page.screenshot({ path: `${outDir}/clip_${c.replace(/[&=]/g, '_')}_${axis}.png` });
  }
  console.log(JSON.stringify({ case: c, hud, errors: [...new Set(errors)].slice(0, 6) }));
  await page.close();
}
await browser.close();
