import { defineConfig, devices } from '@playwright/test';

// Smoke test on the production build, real assets, system Chrome headless, WebGPU then WebGL2.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
    },
  },
  projects: [
    { name: 'webgpu', metadata: { query: '' }, testIgnore: /mobile/ },
    { name: 'webgl', metadata: { query: '?backend=webgl' }, testIgnore: /mobile|offline/ },
    // Phone emulation (touch, narrow viewport), WebGL2 like a phone without WebGPU.
    { name: 'mobile', metadata: { query: '?backend=webgl' }, testMatch: /mobile/, use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:5174/atlas.json',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
