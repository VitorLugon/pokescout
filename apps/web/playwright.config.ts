import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '../../.cache/web-test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 390, height: 844 },
    browserName: 'chromium',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    trace: 'retain-on-failure',
  },
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
