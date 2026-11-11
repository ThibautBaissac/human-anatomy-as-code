import { defineConfig, devices } from '@playwright/test';

// Smoke test on the production build, real assets, system Chrome headless, WebGPU then WebGL2.
// Its own port (HAAC_E2E_PORT, 5175 by default), so that it runs while the dev server holds 5174.
const PORT = Number(process.env.HAAC_E2E_PORT ?? 5175);

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    // the first-visit message is taken as read: it would sit over the view in every test
    storageState: { cookies: [], origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: 'haac.welcome', value: '1' }] }] },
    launchOptions: {
      args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
    },
  },
  projects: [
    { name: 'webgpu', metadata: { query: '' }, testIgnore: /mobile/ },
    { name: 'webgl', metadata: { query: '?backend=webgl' }, testIgnore: /mobile|offline|female/ },
    // Phone emulation (touch, narrow viewport), WebGL2 like a phone without WebGPU.
    { name: 'mobile', metadata: { query: '?backend=webgl' }, testMatch: /mobile/, use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}/atlas-male.json`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
