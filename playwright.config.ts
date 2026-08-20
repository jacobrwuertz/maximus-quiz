import { defineConfig, devices } from '@playwright/test';

// E2E runs against static fixture pages served from the repo root.
// `npm run build` must run first so the IIFE bundle exists for the embed test.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
  },
  // `reuseExistingServer` will adopt ANY process already on 4173 — including a
  // preview server started from another checkout, which serves a different
  // document root and makes every fixture 404. If the whole suite fails at once
  // with missing elements, check the port before suspecting the code:
  //   lsof -ti:4173
  webServer: {
    command: 'node serve.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
