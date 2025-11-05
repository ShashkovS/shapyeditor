import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:63343',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node tests/dev-server.js',
    // url: 'http://localhost:63343/htmls/demo.html',
    url: 'http://localhost:63343/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
